import type { Request, Response } from 'express';
import type { CityResponse, Reader } from 'maxmind';

import {
  getClientIp,
  getCloudflareGeoInfo,
  getLocalIpInfo,
  setCityLookup,
  resetCityLookup,
  handleGetIp,
  handleGetIpAddress,
  handleHealth,
} from '../src/server';

type MutableRequest = Partial<Request> & {
  headers: Record<string, string | string[]>;
  params?: Record<string, string>;
};

function createRequest(overrides: Partial<MutableRequest> = {}): Request {
  const base: MutableRequest = {
    headers: {},
    params: {},
    ...overrides,
  };

  return base as Request;
}

describe('getClientIp', () => {
  it('prefers Cloudflare connecting IP header', () => {
    const req = createRequest({
      headers: {
        'cf-connecting-ip': '203.0.113.1',
        'x-forwarded-for': '198.51.100.1',
      },
    });

    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('falls back to first forwarded IP when Cloudflare header missing', () => {
    const req = createRequest({
      headers: {
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      },
    });

    expect(getClientIp(req)).toBe('198.51.100.1');
  });

  it('returns null when no IP related headers or connection info present', () => {
    const req = createRequest();

    expect(getClientIp(req)).toBeNull();
  });
});

describe('getCloudflareGeoInfo', () => {
  it('returns null when Cloudflare headers missing or incomplete', () => {
    const req = createRequest({
      headers: {},
    });

    expect(getCloudflareGeoInfo(req)).toBeNull();
  });

  it('maps Cloudflare headers into GeoLocationInfo shape', () => {
    const req = createRequest({
      headers: {
        'cf-connecting-ip': '198.51.100.2',
        'cf-ipcountry': 'DE',
        'cf-ipcity': 'Berlin',
        'cf-region': 'BE',
        'cf-timezone': 'Europe/Berlin',
        'cf-iplatitude': '52.52',
        'cf-iplongitude': '13.405',
      },
    });

    const result = getCloudflareGeoInfo(req);
    expect(result).toEqual({
      country_code: 'DE',
      country_name: 'DE',
      city: 'Berlin',
      latitude: 52.52,
      longitude: 13.405,
      IPv4: '198.51.100.2',
      eu: '1',
      region: 'BE',
      timezone: 'Europe/Berlin',
    });
  });
});

describe('getLocalIpInfo', () => {
  afterEach(() => {
    resetCityLookup();
  });

  it('throws when database has not been initialized', () => {
    expect(() => getLocalIpInfo('8.8.8.8')).toThrow('Database not initialized');
  });

  it('throws when lookup cannot find the requested IP', () => {
    setCityLookup({
      get: () => undefined,
    } as unknown as Reader<CityResponse>);

    expect(() => getLocalIpInfo('8.8.8.8')).toThrow('IP address not found in database');
  });
});

describe('HTTP handlers', () => {
  afterEach(() => {
    resetCityLookup();
  });

  function mockCityLookup(response: Partial<CityResponse>): Reader<CityResponse> {
    return {
      get: () => response as CityResponse,
    } as unknown as Reader<CityResponse>;
  }

  function createMockResponse(): Response & { statusCode?: number; jsonBody?: unknown } {
    const res: Partial<Response> & { statusCode?: number; jsonBody?: unknown } = {};
    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res as Response;
    });
    res.json = jest.fn((body: unknown) => {
      res.jsonBody = body;
      return res as Response;
    });

    return res as Response & { statusCode?: number; jsonBody?: unknown };
  }

  it('returns health status', async () => {
    const res = createMockResponse();

    await handleHealth(createRequest(), res);

    expect(res.json).toHaveBeenCalled();
    expect(res.statusCode ?? 200).toBe(200);
    const payload = res.jsonBody as { status: string; timestamp: string };
    expect(payload.status).toBe('healthy');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('returns geolocation data for a specific IP address', async () => {
    const cityResponse: Partial<CityResponse> = {
      country: {
        geoname_id: 6252001,
        iso_code: 'US',
        names: { en: 'United States' },
      },
      city: {
        geoname_id: 5128581,
        names: { en: 'New York' },
      },
      location: {
        accuracy_radius: 10,
        latitude: 40.7128,
        longitude: -74.006,
        time_zone: 'America/New_York',
      },
      subdivisions: [
        {
          geoname_id: 5128638,
          iso_code: 'NY',
          names: { en: 'New York' },
        },
      ],
    };

    setCityLookup(mockCityLookup(cityResponse));

    const res = createMockResponse();
    const req = createRequest({ params: { address: '8.8.8.8' } });

    await handleGetIpAddress(req, res);

    expect(res.statusCode ?? 200).toBe(200);
    expect(res.json).toHaveBeenCalledWith({
      country_code: 'US',
      country_name: 'United States',
      city: 'New York',
      latitude: 40.7128,
      longitude: -74.006,
      IPv4: '8.8.8.8',
      eu: '0',
      region: 'NY',
      timezone: 'America/New_York',
    });
  });

  it('uses local database lookup when Cloudflare data is not present', async () => {
    const cityResponse: Partial<CityResponse> = {
      country: {
        geoname_id: 3017382,
        iso_code: 'FR',
        names: { en: 'France' },
      },
      city: {
        geoname_id: 2988507,
        names: { en: 'Paris' },
      },
      location: {
        accuracy_radius: 5,
        latitude: 48.8566,
        longitude: 2.3522,
        time_zone: 'Europe/Paris',
      },
      subdivisions: [
        {
          geoname_id: 3012874,
          iso_code: 'IDF',
          names: { en: 'Ile-de-France' },
        },
      ],
    };

    setCityLookup(mockCityLookup(cityResponse));

    const res = createMockResponse();
    const req = createRequest({
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    });

    await handleGetIp(req, res);

    expect(res.statusCode ?? 200).toBe(200);
    expect(res.json).toHaveBeenCalledWith({
      country_code: 'FR',
      country_name: 'France',
      city: 'Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      IPv4: '203.0.113.10',
      eu: '1',
      region: 'IDF',
      timezone: 'Europe/Paris',
    });
  });

  it('returns 400 when IP format invalid', async () => {
    const res = createMockResponse();
    const req = createRequest({ params: { address: 'not-an-ip' } });

    await handleGetIpAddress(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid IP address format' });
  });

  it('returns 400 when IP parameter is missing', async () => {
    const res = createMockResponse();
    const req = createRequest({ params: {} });

    await handleGetIpAddress(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'IP address parameter is required' });
  });

  it('returns 500 when database lookup throws for direct IP request', async () => {
    const res = createMockResponse();
    const req = createRequest({ params: { address: '8.8.4.4' } });

    setCityLookup({
      get: () => undefined,
    } as unknown as Reader<CityResponse>);

    await handleGetIpAddress(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'IP address not found in database' });
  });

  it('prefers Cloudflare geolocation data when available', async () => {
    const res = createMockResponse();
    const req = createRequest({
      headers: {
        'cf-connecting-ip': '198.51.100.3',
        'cf-ipcountry': 'ES',
        'cf-ipcity': 'Madrid',
        'cf-region': 'MD',
        'cf-timezone': 'Europe/Madrid',
        'cf-iplatitude': '40.4168',
        'cf-iplongitude': '-3.7038',
        'x-forwarded-for': '198.51.100.3',
      },
    });

    await handleGetIp(req, res);

    expect(res.statusCode ?? 200).toBe(200);
    expect(res.json).toHaveBeenCalledWith({
      country_code: 'ES',
      country_name: 'ES',
      city: 'Madrid',
      latitude: 40.4168,
      longitude: -3.7038,
      IPv4: '198.51.100.3',
      eu: '1',
      region: 'MD',
      timezone: 'Europe/Madrid',
    });
  });

  it('returns 500 when local lookup throws for inferred client IP', async () => {
    const res = createMockResponse();
    const req = createRequest({
      headers: {
        'x-forwarded-for': '198.51.100.55',
      },
    });

    await handleGetIp(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Database not initialized' });
  });

  it('returns 400 when IP missing from request and no headers available', async () => {
    const res = createMockResponse();

    await handleGetIp(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unable to determine client IP address' });
  });
});
