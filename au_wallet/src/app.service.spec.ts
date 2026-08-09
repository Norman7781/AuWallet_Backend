import { AppService } from './app.service';

describe('AppService health', () => {
  it('returns only the safe standard health envelope', () => {
    const result = new AppService().getHealth();

    expect(result).toEqual({
      data: { status: 'ok' },
      message: 'Service is healthy.',
      meta: {},
    });
    expect(Object.keys(result.data)).toEqual(['status']);
    expect(JSON.stringify(result)).not.toMatch(
      /environment|database|supabase|secret|key/i,
    );
  });
});
