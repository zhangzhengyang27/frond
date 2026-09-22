import type { TagDataStore } from '../stores/TagDataStore'
import { typedHandle } from './typedIpc'

export function registerTagIpcHandlers(tagStore: TagDataStore): void {
  typedHandle('tag:getTags', () => tagStore.getTags())
  typedHandle('tag:getTagById', (_event, { id }) => tagStore.getTagById(id))
  typedHandle('tag:addTag', (_event, { name, opts }) => tagStore.addTag(name, opts))
  typedHandle('tag:updateTag', (_event, { id, updates }) => tagStore.updateTag(id, updates))
  typedHandle('tag:deleteTag', (_event, { id }) => tagStore.deleteTag(id))
  typedHandle('tag:getTagsByIds', (_event, { ids }) => tagStore.getTagsByIds(ids))
}
