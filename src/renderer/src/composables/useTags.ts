}

export function useTags(): {
  tags: ShallowRef<Tag[]>
  isLoading: Ref<boolean>
  getTags: () => Promise<void>
  addTag: (name: string) => Promise<Tag | undefined>
  deleteTag: (id: string) => Promise<boolean>
  getTagsByIds: (ids: string[]) => Promise<Tag[]>
} {
  return {
    tags,
    isLoading,
    getTags,
    addTag,
    deleteTag,
    getTagsByIds
  }
}
