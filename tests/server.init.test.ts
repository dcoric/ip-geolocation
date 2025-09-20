type MockOptions = {
  responseFactory?: () => {
    statusCode: number;
    statusMessage?: string;
    headers: Record<string, string>;
    pipe: jest.Mock;
  };
  existsSyncImpl?: (filePath: string) => boolean;
  listenImpl?: jest.Mock;
  openImpl?: jest.Mock<Promise<unknown>, [string]>;
};

function setupModuleMocks(options: MockOptions = {}) {
  const useMock = jest.fn();
  const getMock = jest.fn();
  const listenMock =
    options.listenImpl ||
    jest.fn((port: number, host: string, callback?: () => void) => {
      callback?.();
      return { close: jest.fn() };
    });

  const express = Object.assign(
    () => ({
      use: useMock,
      get: getMock,
      listen: listenMock,
    }),
    {
      json: jest.fn(() => jest.fn()),
    },
  );

  const streamInstances: Array<{ on: jest.Mock; close: jest.Mock }> = [];

  const createWriteStream = jest.fn(() => {
    const instance: { on: jest.Mock; close: jest.Mock } = {
      on: jest.fn(),
      close: jest.fn(),
    };

    instance.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'finish') {
        handler();
      }
      return instance;
    });

    streamInstances.push(instance);
    return instance;
  });
  const existsSync = options.existsSyncImpl
    ? jest.fn((filePath: string) => options.existsSyncImpl?.(filePath))
    : jest.fn(() => false);
  const mkdirSync = jest.fn();
  const statSync = jest.fn(() => ({ size: 1024 * 1024 }));

  const requestOn = jest.fn();
  const httpsGet = jest.fn(
    (url: string, callback: (response: { statusCode: number; statusMessage?: string; headers: Record<string, string>; pipe: jest.Mock }) => void) => {
      const response = options.responseFactory
        ? options.responseFactory()
        : {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            pipe: jest.fn(),
          };

      callback(response);

      const request: { on: jest.Mock } = {
        on: jest.fn(),
      };

      request.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        requestOn(event, handler);
        return request;
      });

      return request;
    },
  );

  const openMock =
    options.openImpl || jest.fn(async (_path: string) => ({ get: jest.fn(() => ({})) }));

  jest.doMock('express', () => express);
  jest.doMock('fs', () => ({
    createWriteStream,
    existsSync,
    mkdirSync,
    statSync,
  }));
  jest.doMock('https', () => ({ get: httpsGet }));
  jest.doMock('maxmind', () => ({ open: openMock }));

  return {
    useMock,
    getMock,
    listenMock,
    createWriteStream,
    existsSync,
    mkdirSync,
    statSync,
    httpsGet,
    openMock,
    streamInstances,
    requestOn,
  };
}

describe('server initialization helpers', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('downloadFile resolves on successful HTTP response', async () => {
    jest.resetModules();
    setupModuleMocks();
    const server = await import('../src/server');

    await expect(
      server.__testables.downloadFile('https://example.com/file', '/tmp/file'),
    ).resolves.toBeUndefined();

    expect(server.__testables).toBeDefined();
  });

  it('downloadFile rejects when redirect location header missing', async () => {
    jest.resetModules();
    setupModuleMocks({
      responseFactory: () => ({
        statusCode: 302,
        statusMessage: 'Found',
        headers: {},
        pipe: jest.fn(),
      }),
    });
    const server = await import('../src/server');

    await expect(
      server.__testables.downloadFile('https://example.com/file', '/tmp/file'),
    ).rejects.toThrow('Redirect without location header');
  });

  it('downloadFile rejects on non-200 HTTP responses', async () => {
    jest.resetModules();
    setupModuleMocks({
      responseFactory: () => ({
        statusCode: 404,
        statusMessage: 'Not Found',
        headers: {},
        pipe: jest.fn(),
      }),
    });
    const server = await import('../src/server');

    await expect(
      server.__testables.downloadFile('https://example.com/file', '/tmp/file'),
    ).rejects.toThrow('HTTP 404: Not Found');
  });

  it('downloadDatabase creates directory and downloads file when missing', async () => {
    jest.resetModules();
    const mocks = setupModuleMocks();
    const server = await import('../src/server');

    await server.__testables.downloadDatabase();

    expect(mocks.mkdirSync).toHaveBeenCalled();
    expect(mocks.httpsGet).toHaveBeenCalled();
    expect(mocks.statSync).toHaveBeenCalled();
  });

  it('initializeDatabase loads existing database without download', async () => {
    jest.resetModules();
    const mocks = setupModuleMocks({
      existsSyncImpl: (filePath) => filePath.includes('GeoLite2-City.mmdb'),
    });
    const server = await import('../src/server');

    await server.__testables.initializeDatabase();

    expect(mocks.openMock).toHaveBeenCalledTimes(1);
    expect(mocks.mkdirSync).not.toHaveBeenCalled();
  });

  it('initializeDatabase downloads database when file missing', async () => {
    jest.resetModules();
    const mocks = setupModuleMocks();
    const server = await import('../src/server');

    await server.__testables.initializeDatabase();

    expect(mocks.mkdirSync).toHaveBeenCalled();
    expect(mocks.httpsGet).toHaveBeenCalled();
  });

  it('initializeDatabase exits process on failure', async () => {
    jest.resetModules();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    setupModuleMocks({
      existsSyncImpl: () => true,
      openImpl: jest.fn(async (_path: string) => {
        throw new Error('boom');
      }),
    });
    const server = await import('../src/server');

    await server.__testables.initializeDatabase();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Failed to initialize GeoLite2 database:', 'boom');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('startServer initializes database then listens', async () => {
    jest.resetModules();
    const mocks = setupModuleMocks({
      existsSyncImpl: (filePath) => filePath.includes('GeoLite2-City.mmdb'),
    });
    const server = await import('../src/server');

    await server.startServer();

    expect(mocks.listenMock).toHaveBeenCalledWith(
      expect.any(Number),
      '0.0.0.0',
      expect.any(Function),
    );
  });

  it('auto-start logs and exits when startServer rejects outside test env', async () => {
    const originalEnv = process.env.NODE_ENV;
    jest.resetModules();
    process.env.NODE_ENV = 'production';

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const listenFailMock = jest.fn(
        (_port: number, _host: string, _callback?: () => void) => {
          throw new Error('listen failure');
        },
      );

      setupModuleMocks({
        existsSyncImpl: () => true,
        listenImpl: listenFailMock,
      });

      await import('../src/server');
      await new Promise((resolve) => setImmediate(resolve));

      expect(errorSpy).toHaveBeenCalledWith('Failed to start server:', 'listen failure');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      process.env.NODE_ENV = originalEnv;
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
