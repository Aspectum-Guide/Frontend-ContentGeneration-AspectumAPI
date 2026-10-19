import { useState } from 'react';
import { Button, ConfirmModal, EmptyState, Heading, IconButton, Sidebar, Spinner, Toast, TreeNav, useToast } from '@aspectum/ui';
import useSessionSidebarData from './useSessionSidebarData';
import { ChevronDown, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';

const getName = (item) => {
  if (!item?.name) return 'Без названия';
  if (typeof item.name === 'object') return item.name.en || item.name.ru || Object.values(item.name)[0] || 'Без названия';
  return item.name;
};

export default function SessionSidebar({ session, onCitySelect, selectedCityId, onCitiesChange, initialCities }) {
  const data = useSessionSidebarData({ session, initialCities, onCitiesChange });
  const { cities, attractions, loading, creating, expandedCities, toggleCity, loadData, createCity, deleteCity } = data;
  const { note, showNote } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const items = cities.map((city) => ({
    ...city,
    children: attractions
      .filter((attraction) => attraction.session === session?.id)
      .map((attraction) => ({ ...attraction, __treeKind: 'attraction' })),
  }));

  const handleCreate = async () => {
    try {
      const created = await createCity();
      if (created) onCitySelect?.(created);
    } catch (error) {
      console.error('Ошибка создания города:', error);
      showNote(error?.response?.status === 429 ? 'Сервер перегружен (429). Попробуйте ещё раз через несколько секунд.' : 'Не удалось создать город', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCity(deleteTarget.id);
      setDeleteTarget(null);
      onCitySelect?.(undefined);
    } catch (error) {
      console.error('Ошибка удаления города:', error);
      showNote('Не удалось удалить город', 'error');
    }
  };

  if (loading) return <Sidebar className="w-80 bg-aspectum-surface"><EmptyState icon={<Spinner size="sm" />} title="Загрузка..." spacing="md" /></Sidebar>;

  return (
    <Sidebar className="w-80 overflow-y-auto bg-aspectum-surface">
      <div className="p-4">
        <Heading level={3} className="mb-4">Содержание</Heading>
        <div className="flex items-center justify-between mb-2">
          <Heading level={4} size="xs" weight="medium" tone="strong">Города</Heading>
          <Button type="button" onClick={handleCreate} disabled={creating} variant="link" size="sm" className={creating ? 'text-aspectum-text-disabled' : 'text-aspectum-primary hover:text-aspectum-primary-strong'}>
            {creating ? 'Создание...' : '+ Создать'}
          </Button>
        </div>
        <TreeNav
          items={items}
          expandedIds={expandedCities}
          selectedId={selectedCityId}
          getItemId={(item) => item.id}
          onSelect={onCitySelect}
          renderItem={(item, state) => item.__treeKind === 'attraction' ? (
            <div className="text-xs p-2 bg-aspectum-surface rounded border border-aspectum-border hover:border-aspectum-primary-border-strong cursor-pointer">{getName(item)}</div>
          ) : (
            <div className="border border-aspectum-border rounded-aspectum-compact">
              <div className={`p-3 cursor-pointer hover:bg-aspectum-surface-muted flex items-center justify-between ${state.selected ? 'bg-aspectum-primary-soft border-aspectum-focus' : ''}`} onClick={state.onSelect}>
                <div className="flex-1"><div className="text-sm font-medium text-aspectum-text">{getName(item)}</div>{item.country && <div className="text-xs text-aspectum-text-muted">{item.country}</div>}</div>
                {session?.content_type === 'city_with_attractions' && <IconButton label={state.expanded ? 'Свернуть город' : 'Развернуть город'} onClick={(event) => { event.stopPropagation(); toggleCity(item.id); }} className="ml-2">{state.expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}</IconButton>}
                <Button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(item); }} variant="ghostDanger" size="sm" className="ml-2" title="Удалить город" aria-label="Удалить город"><Trash2 className="size-4" aria-hidden="true" /></Button>
              </div>
            </div>
          )}
        />
        <Button type="button" onClick={loadData} variant="outline" size="md" className="mt-4 w-full gap-2"><RefreshCw className="size-4" aria-hidden="true" /> Обновить список</Button>
      </div>
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить город из сессии?"
        message={`Город «${getName(deleteTarget)}» будет удалён из текущей сессии.`}
        confirmLabel="Удалить"
        danger
      />
      <Toast note={note} />
    </Sidebar>
  );
}
