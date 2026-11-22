import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useSessionSidebarData from './useSessionSidebarData';
import { attractionsAPI, citiesAPI } from '../../api/generation';

vi.mock('../../api/generation', () => ({
  citiesAPI: {
    get: vi.fn(),
    createOrUpdate: vi.fn(),
    delete: vi.fn(),
  },
  attractionsAPI: { list: vi.fn() },
}));

const session = { id: 'session-1' };
const cities = [{ id: 'city-1', name: { ru: 'Москва' } }];
const attractions = [{ id: 'attr-1', session: 'session-1', name: { ru: 'Кремль' } }];

beforeEach(() => {
  vi.clearAllMocks();
  citiesAPI.get.mockResolvedValue({ data: cities });
  attractionsAPI.list.mockResolvedValue({ data: attractions });
});

describe('useSessionSidebarData', () => {
  it('loads cities and attractions and notifies the consumer', async () => {
    const onCitiesChange = vi.fn();
    const { result } = renderHook(() => useSessionSidebarData({ session, onCitiesChange }));

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    expect(result.current.cities).toEqual(cities);
    expect(result.current.attractions).toEqual(attractions);
    expect(onCitiesChange).toHaveBeenCalledWith(cities);
  });

  it('uses initial cities immediately while loading the rest', async () => {
    const initialCities = [{ id: 'initial', name: 'Initial' }];
    const { result } = renderHook(() => useSessionSidebarData({ session, initialCities }));

    await waitFor(() => expect(result.current.cities).toEqual(cities));
    expect(result.current.loading).toBe(false);
  });

  it('creates and deletes a city through the API', async () => {
    const created = { id: 'city-2', name: { ru: 'Тула' } };
    citiesAPI.createOrUpdate.mockResolvedValue({ data: created });
    citiesAPI.delete.mockResolvedValue({});
    const { result } = renderHook(() => useSessionSidebarData({ session }));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    let createdCity;
    await act(async () => { createdCity = await result.current.createCity(); });
    expect(createdCity).toEqual(created);
    expect(citiesAPI.createOrUpdate).toHaveBeenCalledWith({ session: session.id, name: {}, description: {} });

    await act(async () => { await result.current.deleteCity('city-1'); });
    expect(citiesAPI.delete).toHaveBeenCalledWith('city-1');
  });

  it('retries a rate-limited load', async () => {
    citiesAPI.get
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({ data: cities });
    const { result } = renderHook(() => useSessionSidebarData({ session }));

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
    expect(citiesAPI.get).toHaveBeenCalledTimes(2);
  });
});
