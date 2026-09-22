
defineProps<Props>()

const router = useRouter()

const handleGoBack = (): void => {
  // 剪辑的入口在历史页（handleClipVideo），返回应回到来源页
  router.push({ name: 'screenRecorderHistory' })
}
</script>
