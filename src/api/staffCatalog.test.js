import { describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { listAllStaffEvents, staffCatalogAPI } from './staffCatalog';

describe('listAllStaffEvents', () => {
  it('собирает все страницы staff-каталога', async () => {
    const spy = vi.spyOn(staffCatalogAPI, 'events')
      .mockResolvedValueOnce({ data: { events: [{ id: '1' }], total_pages: 2 } })
      .mockResolvedValueOnce({ data: { events: [{ id: '2' }], total_pages: 2 } });

    const events = await listAllStaffEvents({ city_id: 'rome' }, 200);

    expect(events.map((row) => row.id)).toEqual(['1', '2']);
    expect(spy).toHaveBeenNthCalledWith(1, { city_id: 'rome', page: 1, page_size: 200 });
    expect(spy).toHaveBeenNthCalledWith(2, { city_id: 'rome', page: 2, page_size: 200 });
    spy.mockRestore();
  });
});

describe('staffCatalogAPI.uploadImage', () => {
  it('отправляет файл полем image на /media/images/', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { id: 'pic', url: '/m/pic' } });
    const file = new File(['png'], 'icon.png', { type: 'image/png' });

    const response = await staffCatalogAPI.uploadImage(file);

    expect(response.data).toEqual({ id: 'pic', url: '/m/pic' });
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/media/images/');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('image')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    post.mockRestore();
  });
});
