/**
 * Leaf · Emoji 数据集（常用 Emoji + 中英文关键词）
 *
 * 对标 Raycast Emoji Search：输入关键词搜索 Emoji，回车复制。
 * 数据集包含常用 Emoji，覆盖表情、手势、物品、自然、符号等类别。
 */

export interface EmojiItem {
  emoji: string
  name: string
  keywords: string[]
  category: string
}

export const EMOJI_LIST: EmojiItem[] = [
  // 表情
  {
    emoji: '😀',
    name: '笑脸',
    keywords: ['smile', 'happy', '开心', '高兴', '笑'],
    category: '表情'
  },
  {
    emoji: '😂',
    name: '笑哭',
    keywords: ['laugh', 'tears', '笑哭', '大笑', '搞笑'],
    category: '表情'
  },
  {
    emoji: '🥰',
    name: '喜爱',
    keywords: ['love', 'heart', '喜欢', '爱', '心动'],
    category: '表情'
  },
  { emoji: '😎', name: '酷', keywords: ['cool', '酷', '墨镜', '帅'], category: '表情' },
  {
    emoji: '🤔',
    name: '思考',
    keywords: ['think', '思考', '想', '疑问', '考虑'],
    category: '表情'
  },
  { emoji: '😴', name: '困', keywords: ['sleep', 'sleepy', '困', '睡觉', '累'], category: '表情' },
  { emoji: '😷', name: '口罩', keywords: ['mask', '口罩', '生病', '感冒'], category: '表情' },
  {
    emoji: '🤯',
    name: '爆炸头',
    keywords: ['mind blown', '爆炸', '震惊', '惊讶'],
    category: '表情'
  },
  { emoji: '😭', name: '大哭', keywords: ['cry', 'sad', '哭', '难过', '伤心'], category: '表情' },
  { emoji: '😡', name: '生气', keywords: ['angry', 'mad', '生气', '愤怒', '火'], category: '表情' },
  {
    emoji: '🥺',
    name: '恳求',
    keywords: ['pleading', '可怜', '求', '拜托', '委屈'],
    category: '表情'
  },
  { emoji: '😅', name: '尴尬笑', keywords: ['sweat', '尴尬', '汗', '苦笑'], category: '表情' },
  {
    emoji: '🙏',
    name: '祈祷',
    keywords: ['pray', 'thanks', '感谢', '拜托', '祈祷', '谢谢'],
    category: '表情'
  },
  { emoji: '👏', name: '鼓掌', keywords: ['clap', '鼓掌', '赞', '好', '恭喜'], category: '手势' },
  {
    emoji: '👍',
    name: '点赞',
    keywords: ['thumbs up', 'like', '赞', '好', '同意', '顶'],
    category: '手势'
  },
  {
    emoji: '👎',
    name: '踩',
    keywords: ['thumbs down', 'dislike', '踩', '不好', '反对'],
    category: '手势'
  },
  {
    emoji: '✌️',
    name: '胜利',
    keywords: ['victory', 'peace', '胜利', '耶', '和平'],
    category: '手势'
  },
  { emoji: '🤝', name: '握手', keywords: ['handshake', '握手', '合作', '达成'], category: '手势' },
  {
    emoji: '💪',
    name: '肌肉',
    keywords: ['muscle', 'strong', '强', '力量', '加油', '努力'],
    category: '手势'
  },
  {
    emoji: '🙌',
    name: '举手',
    keywords: ['raise hands', '欢呼', '庆祝', '举手'],
    category: '手势'
  },
  { emoji: '👀', name: '眼睛', keywords: ['eyes', '看', '关注', '盯着', '眼神'], category: '身体' },
  {
    emoji: '❤️',
    name: '红心',
    keywords: ['heart', 'love', '爱', '心', '喜欢', '红色'],
    category: '符号'
  },
  { emoji: '🧡', name: '橙心', keywords: ['orange heart', '橙心', '橙色'], category: '符号' },
  { emoji: '💛', name: '黄心', keywords: ['yellow heart', '黄心', '黄色'], category: '符号' },
  { emoji: '💚', name: '绿心', keywords: ['green heart', '绿心', '绿色'], category: '符号' },
  { emoji: '💙', name: '蓝心', keywords: ['blue heart', '蓝心', '蓝色'], category: '符号' },
  { emoji: '💜', name: '紫心', keywords: ['purple heart', '紫心', '紫色'], category: '符号' },
  { emoji: '🖤', name: '黑心', keywords: ['black heart', '黑心', '黑色'], category: '符号' },
  {
    emoji: '💯',
    name: '满分',
    keywords: ['100', 'perfect', '满分', '完美', '一百'],
    category: '符号'
  },
  {
    emoji: '✨',
    name: '闪光',
    keywords: ['sparkles', '闪光', '闪亮', '星星', '特效'],
    category: '符号'
  },
  {
    emoji: '🔥',
    name: '火',
    keywords: ['fire', 'hot', '火', '热', '热门', '厉害', '燃'],
    category: '自然'
  },
  { emoji: '⭐', name: '星星', keywords: ['star', '星星', '星', '收藏', '推荐'], category: '自然' },
  { emoji: '🌟', name: '闪亮星', keywords: ['glowing star', '闪亮', '明星'], category: '自然' },
  {
    emoji: '🎉',
    name: '庆祝',
    keywords: ['party', 'celebration', '庆祝', '撒花', '开心', '恭喜'],
    category: '活动'
  },
  { emoji: '🎊', name: '彩带', keywords: ['confetti', '彩带', '庆祝', '节日'], category: '活动' },
  {
    emoji: '🎁',
    name: '礼物',
    keywords: ['gift', 'present', '礼物', '送礼', '惊喜'],
    category: '活动'
  },
  {
    emoji: '🏆',
    name: '奖杯',
    keywords: ['trophy', '奖杯', '冠军', '第一', '获奖'],
    category: '活动'
  },
  {
    emoji: '✅',
    name: '对勾',
    keywords: ['check', 'done', '完成', '对', '正确', '通过'],
    category: '符号'
  },
  {
    emoji: '❌',
    name: '叉',
    keywords: ['cross', 'wrong', '错', '错误', '取消', '关闭'],
    category: '符号'
  },
  {
    emoji: '⚠️',
    name: '警告',
    keywords: ['warning', '警告', '注意', '危险', '提醒'],
    category: '符号'
  },
  {
    emoji: '🚀',
    name: '火箭',
    keywords: ['rocket', '火箭', '发射', '起飞', '上线', '发布'],
    category: '交通'
  },
  {
    emoji: '💡',
    name: '灯泡',
    keywords: ['light bulb', '灯泡', '想法', '灵感', '主意', '提示'],
    category: '物品'
  },
  {
    emoji: '📝',
    name: '笔记',
    keywords: ['memo', 'note', '笔记', '记录', '写', '备忘录'],
    category: '物品'
  },
  {
    emoji: '📌',
    name: '图钉',
    keywords: ['pin', '图钉', '固定', '置顶', '标记'],
    category: '物品'
  },
  {
    emoji: '🔔',
    name: '铃铛',
    keywords: ['bell', '铃铛', '通知', '提醒', '响铃'],
    category: '物品'
  },
  { emoji: '🔕', name: '静音', keywords: ['mute', '静音', '勿扰', '安静'], category: '物品' },
  {
    emoji: '⏰',
    name: '闹钟',
    keywords: ['alarm', '闹钟', '时间', '提醒', '起床'],
    category: '物品'
  },
  {
    emoji: '⏳',
    name: '沙漏',
    keywords: ['hourglass', '沙漏', '等待', '时间', '进行中'],
    category: '物品'
  },
  {
    emoji: '📅',
    name: '日历',
    keywords: ['calendar', '日历', '日期', '日程', '安排'],
    category: '物品'
  },
  {
    emoji: '📈',
    name: '上升图',
    keywords: ['chart up', '上升', '增长', '趋势', '涨'],
    category: '物品'
  },
  { emoji: '📉', name: '下降图', keywords: ['chart down', '下降', '减少', '跌'], category: '物品' },
  {
    emoji: '💰',
    name: '钱袋',
    keywords: ['money', '钱', '财富', '付款', '工资'],
    category: '物品'
  },
  {
    emoji: '💳',
    name: '信用卡',
    keywords: ['credit card', '信用卡', '银行卡', '支付'],
    category: '物品'
  },
  {
    emoji: '🛒',
    name: '购物车',
    keywords: ['cart', '购物车', '购物', '买', '下单'],
    category: '物品'
  },
  {
    emoji: '🐛',
    name: '虫子',
    keywords: ['bug', '虫子', '缺陷', '问题', '错误'],
    category: '动物'
  },
  { emoji: '🐱', name: '猫', keywords: ['cat', '猫', '猫咪', '喵'], category: '动物' },
  { emoji: '🐶', name: '狗', keywords: ['dog', '狗', '狗狗', '汪'], category: '动物' },
  { emoji: '🌈', name: '彩虹', keywords: ['rainbow', '彩虹', '多彩', '希望'], category: '自然' },
  { emoji: '☀️', name: '太阳', keywords: ['sun', '太阳', '晴天', '阳光', '热'], category: '自然' },
  {
    emoji: '🌙',
    name: '月亮',
    keywords: ['moon', '月亮', '夜晚', '晚上', '晚安'],
    category: '自然'
  },
  { emoji: '☁️', name: '云', keywords: ['cloud', '云', '阴天', '多云'], category: '自然' },
  { emoji: '❄️', name: '雪花', keywords: ['snow', '雪', '雪花', '冷', '冬天'], category: '自然' },
  { emoji: '🌊', name: '海浪', keywords: ['wave', '海浪', '海', '水', '波浪'], category: '自然' },
  {
    emoji: '🌱',
    name: '幼苗',
    keywords: ['seedling', '幼苗', '发芽', '成长', '新生'],
    category: '自然'
  },
  { emoji: '🍀', name: '四叶草', keywords: ['clover', '四叶草', '幸运', '好运'], category: '自然' },
  { emoji: '🍕', name: '披萨', keywords: ['pizza', '披萨', '比萨', '吃'], category: '食物' },
  { emoji: '🍔', name: '汉堡', keywords: ['burger', '汉堡', '吃', '快餐'], category: '食物' },
  {
    emoji: '☕',
    name: '咖啡',
    keywords: ['coffee', '咖啡', '喝', '提神', '拿铁'],
    category: '食物'
  },
  { emoji: '🍺', name: '啤酒', keywords: ['beer', '啤酒', '喝', '酒', '干杯'], category: '食物' },
  { emoji: '🍎', name: '苹果', keywords: ['apple', '苹果', '水果', '吃'], category: '食物' },
  { emoji: '🎂', name: '蛋糕', keywords: ['cake', '蛋糕', '生日', '庆祝', '甜'], category: '食物' },
  {
    emoji: '💻',
    name: '电脑',
    keywords: ['laptop', '电脑', '笔记本', '工作', '代码', '编程'],
    category: '物品'
  },
  { emoji: '📱', name: '手机', keywords: ['phone', '手机', '移动', '电话'], category: '物品' },
  { emoji: '⌨️', name: '键盘', keywords: ['keyboard', '键盘', '打字', '输入'], category: '物品' },
  { emoji: '🖱️', name: '鼠标', keywords: ['mouse', '鼠标', '点击'], category: '物品' },
  { emoji: '🎮', name: '游戏手柄', keywords: ['game', '游戏', '手柄', '玩'], category: '物品' },
  { emoji: '🎵', name: '音乐', keywords: ['music', '音乐', '音符', '歌', '听'], category: '物品' },
  {
    emoji: '🎬',
    name: '电影',
    keywords: ['movie', 'film', '电影', '视频', '看'],
    category: '物品'
  },
  {
    emoji: '📷',
    name: '相机',
    keywords: ['camera', '相机', '拍照', '照片', '摄影'],
    category: '物品'
  },
  {
    emoji: '✈️',
    name: '飞机',
    keywords: ['airplane', 'plane', '飞机', '旅行', '飞', '航班'],
    category: '交通'
  },
  { emoji: '🚗', name: '汽车', keywords: ['car', '汽车', '车', '驾驶', '出行'], category: '交通' },
  {
    emoji: '🏠',
    name: '房子',
    keywords: ['house', 'home', '房子', '家', '回家', '住宅'],
    category: '地点'
  },
  {
    emoji: '🏢',
    name: '办公楼',
    keywords: ['office', 'building', '办公楼', '公司', '工作'],
    category: '地点'
  },
  {
    emoji: '📍',
    name: '定位',
    keywords: ['location', 'pin', '定位', '位置', '地点', '打卡'],
    category: '地点'
  },
  {
    emoji: '🔗',
    name: '链接',
    keywords: ['link', '链接', '网址', '连接', '关联'],
    category: '符号'
  },
  {
    emoji: '📎',
    name: '回形针',
    keywords: ['paperclip', '附件', '回形针', '别针'],
    category: '物品'
  },
  {
    emoji: '🔍',
    name: '放大镜',
    keywords: ['search', 'magnifying', '搜索', '查找', '放大', '看'],
    category: '物品'
  },
  {
    emoji: '🛠️',
    name: '工具',
    keywords: ['tools', '工具', '设置', '维修', '锤子'],
    category: '物品'
  },
  {
    emoji: '⚙️',
    name: '齿轮',
    keywords: ['gear', 'settings', '设置', '齿轮', '配置', '选项'],
    category: '符号'
  },
  {
    emoji: '🏷️',
    name: '标签',
    keywords: ['label', 'tag', '标签', '标记', '分类'],
    category: '物品'
  },
  {
    emoji: '💬',
    name: '对话',
    keywords: ['chat', 'message', '对话', '消息', '聊天', '评论', '回复'],
    category: '物品'
  },
  {
    emoji: '📢',
    name: '喇叭',
    keywords: ['megaphone', '喇叭', '广播', '通知', '公告', '宣传'],
    category: '物品'
  },
  {
    emoji: '💤',
    name: '睡眠',
    keywords: ['sleep', 'zzz', '睡觉', '困', '休息', '晚安'],
    category: '符号'
  },
  {
    emoji: '🧠',
    name: '大脑',
    keywords: ['brain', '大脑', '脑子', '思考', '智慧', '记忆'],
    category: '身体'
  },
  {
    emoji: '❤️‍🔥',
    name: '热心',
    keywords: ['heart on fire', '热心', '热爱', '激情'],
    category: '符号'
  },
  { emoji: '🆗', name: 'OK', keywords: ['ok', 'okay', '好的', '可以', '没问题'], category: '符号' },
  { emoji: '🆕', name: '新', keywords: ['new', '新', '最新', '新品', '新增'], category: '符号' },
  { emoji: '🆓', name: '免费', keywords: ['free', '免费', '自由', '不要钱'], category: '符号' },
  // ── 补充：更多表情 ──
  {
    emoji: '🤣',
    name: '笑翻',
    keywords: ['rofl', '笑翻', '笑死', '哈哈', '搞笑'],
    category: '表情'
  },
  {
    emoji: '😊',
    name: '微笑',
    keywords: ['smile', 'blush', '微笑', '害羞', '开心'],
    category: '表情'
  },
  {
    emoji: '🙂',
    name: '浅笑',
    keywords: ['slight smile', '浅笑', '微笑', '呵呵'],
    category: '表情'
  },
  { emoji: '😉', name: '眨眼', keywords: ['wink', '眨眼', '调皮', '使眼色'], category: '表情' },
  {
    emoji: '😍',
    name: '花痴',
    keywords: ['heart eyes', '花痴', '喜欢', '心动', '爱慕'],
    category: '表情'
  },
  { emoji: '😘', name: '飞吻', keywords: ['kiss', '飞吻', '亲亲', '爱你'], category: '表情' },
  {
    emoji: '😜',
    name: '调皮',
    keywords: ['tongue', '吐舌', '调皮', '顽皮', '鬼脸'],
    category: '表情'
  },
  { emoji: '🤪', name: '滑稽', keywords: ['zany', '滑稽', '疯狂', '搞怪'], category: '表情' },
  { emoji: '🤗', name: '拥抱', keywords: ['hug', '拥抱', '抱抱', '温暖'], category: '表情' },
  { emoji: '🤫', name: '嘘', keywords: ['shush', '嘘', '安静', '保密', '小声'], category: '表情' },
  {
    emoji: '🤭',
    name: '捂嘴笑',
    keywords: ['hand over mouth', '捂嘴', '偷笑', '惊讶'],
    category: '表情'
  },
  {
    emoji: '😏',
    name: '得意',
    keywords: ['smirk', '得意', '坏笑', '自信', '傲慢'],
    category: '表情'
  },
  {
    emoji: '😒',
    name: '无语',
    keywords: ['unamused', '无语', '翻白眼', '不屑', '呵呵'],
    category: '表情'
  },
  {
    emoji: '🙄',
    name: '翻白眼',
    keywords: ['eye roll', '翻白眼', '无语', '不耐烦', '鄙视'],
    category: '表情'
  },
  {
    emoji: '😬',
    name: '龇牙',
    keywords: ['grimace', '龇牙', '尴尬', '紧张', '咧嘴'],
    category: '表情'
  },
  {
    emoji: '😮‍💨',
    name: '叹气',
    keywords: ['sigh', '叹气', '松口气', '无奈', '累'],
    category: '表情'
  },
  {
    emoji: '🤒',
    name: '发烧',
    keywords: ['fever', '发烧', '生病', '感冒', '难受'],
    category: '表情'
  },
  { emoji: '🤕', name: '受伤', keywords: ['injury', '受伤', '包扎', '疼', '痛'], category: '表情' },
  // ── 补充：更多手势 ──
  {
    emoji: '👋',
    name: '挥手',
    keywords: ['wave', '挥手', '你好', '再见', '打招呼'],
    category: '手势'
  },
  { emoji: '🤚', name: '举手', keywords: ['raised hand', '举手', '停', '等等'], category: '手势' },
  { emoji: '✋', name: '手掌', keywords: ['hand', '手掌', '停', '举手', '击掌'], category: '手势' },
  {
    emoji: '👌',
    name: 'OK手势',
    keywords: ['ok hand', 'ok', '好的', '没问题', '完美'],
    category: '手势'
  },
  {
    emoji: '🤌',
    name: '捏手指',
    keywords: ['pinched fingers', '捏', '意大利手', '多少'],
    category: '手势'
  },
  { emoji: '🤏', name: '捏', keywords: ['pinching', '捏', '一点点', '很小'], category: '手势' },
  {
    emoji: '👈',
    name: '左指',
    keywords: ['point left', '左指', '看左边', '那个'],
    category: '手势'
  },
  {
    emoji: '👉',
    name: '右指',
    keywords: ['point right', '右指', '看这里', '注意', '那个'],
    category: '手势'
  },
  { emoji: '👆', name: '上指', keywords: ['point up', '上指', '上面', '注意'], category: '手势' },
  {
    emoji: '👇',
    name: '下指',
    keywords: ['point down', '下指', '下面', '看这里'],
    category: '手势'
  },
  {
    emoji: '☝️',
    name: '食指',
    keywords: ['index finger', '食指', '第一', '注意', '点'],
    category: '手势'
  },
  {
    emoji: '✊',
    name: '拳头',
    keywords: ['fist', '拳头', '加油', '力量', '奋斗'],
    category: '手势'
  },
  { emoji: '👊', name: '出拳', keywords: ['punch', '出拳', '打拳', '加油'], category: '手势' },
  {
    emoji: '🫶',
    name: '爱心手',
    keywords: ['heart hands', '比心', '爱心手', '爱'],
    category: '手势'
  },
  // ── 补充：更多物品 ──
  {
    emoji: '🖥️',
    name: '台式电脑',
    keywords: ['desktop', '台式机', '电脑', '显示器'],
    category: '物品'
  },
  {
    emoji: '🎧',
    name: '耳机',
    keywords: ['headphones', '耳机', '听音乐', '听歌'],
    category: '物品'
  },
  {
    emoji: '🎤',
    name: '麦克风',
    keywords: ['microphone', '麦克风', '唱歌', '录音', '话筒'],
    category: '物品'
  },
  {
    emoji: '📸',
    name: '拍照',
    keywords: ['camera with flash', '拍照', '快照', '摄影'],
    category: '物品'
  },
  {
    emoji: '📹',
    name: '摄像机',
    keywords: ['video camera', '摄像机', '录像', '拍摄'],
    category: '物品'
  },
  { emoji: '📺', name: '电视', keywords: ['tv', '电视', '看电视', '节目'], category: '物品' },
  {
    emoji: '🎯',
    name: '靶心',
    keywords: ['target', '目标', '靶心', '精准', '命中'],
    category: '活动'
  },
  {
    emoji: '🏃',
    name: '跑步',
    keywords: ['runner', '跑步', '运动', '健身', '跑'],
    category: '活动'
  },
  { emoji: '🚴', name: '骑车', keywords: ['cyclist', '骑车', '自行车', '运动'], category: '活动' },
  {
    emoji: '🏋️',
    name: '举重',
    keywords: ['weightlifter', '举重', '健身', '力量训练'],
    category: '活动'
  },
  {
    emoji: '🧘',
    name: '冥想',
    keywords: ['meditation', '冥想', '瑜伽', '放松', '静心'],
    category: '活动'
  },
  // ── 补充：更多食物 ──
  {
    emoji: '🍜',
    name: '面条',
    keywords: ['noodles', '面条', '拉面', '吃面', '粉'],
    category: '食物'
  },
  { emoji: '🍚', name: '米饭', keywords: ['rice', '米饭', '吃饭', '白饭'], category: '食物' },
  { emoji: '🍣', name: '寿司', keywords: ['sushi', '寿司', '日料', '日本料理'], category: '食物' },
  { emoji: '🍱', name: '便当', keywords: ['bento', '便当', '盒饭', '午餐'], category: '食物' },
  { emoji: '🍙', name: '饭团', keywords: ['rice ball', '饭团', '日式'], category: '食物' },
  {
    emoji: '🍤',
    name: '炸虾',
    keywords: ['fried shrimp', '炸虾', '天妇罗', '虾'],
    category: '食物'
  },
  {
    emoji: '🍦',
    name: '冰淇淋',
    keywords: ['ice cream', '冰淇淋', '雪糕', '甜筒'],
    category: '食物'
  },
  {
    emoji: '🍩',
    name: '甜甜圈',
    keywords: ['donut', '甜甜圈', '面包圈', '甜点'],
    category: '食物'
  },
  { emoji: '🍪', name: '饼干', keywords: ['cookie', '饼干', '曲奇', '零食'], category: '食物' },
  {
    emoji: '🍫',
    name: '巧克力',
    keywords: ['chocolate', '巧克力', '零食', '甜'],
    category: '食物'
  },
  { emoji: '🍬', name: '糖果', keywords: ['candy', '糖果', '糖', '零食'], category: '食物' },
  { emoji: '🍭', name: '棒棒糖', keywords: ['lollipop', '棒棒糖', '糖果', '甜'], category: '食物' },
  {
    emoji: '🥤',
    name: '奶茶',
    keywords: ['cup with straw', '奶茶', '饮料', '喝的', '咖啡', '可乐'],
    category: '食物'
  },
  {
    emoji: '🧋',
    name: '珍珠奶茶',
    keywords: ['bubble tea', '珍珠奶茶', '奶茶', '波霸'],
    category: '食物'
  },
  { emoji: '🍵', name: '茶', keywords: ['tea', '茶', '喝茶', '绿茶', '红茶'], category: '食物' },
  { emoji: '🍶', name: '清酒', keywords: ['sake', '清酒', '日本酒', '喝酒'], category: '食物' },
  {
    emoji: '🥂',
    name: '干杯',
    keywords: ['champagne', '干杯', '庆祝', '香槟', '酒会'],
    category: '食物'
  },
  { emoji: '🍷', name: '红酒', keywords: ['wine', '红酒', '葡萄酒', '喝酒'], category: '食物' },
  {
    emoji: '🥃',
    name: '威士忌',
    keywords: ['whiskey', '威士忌', '洋酒', '喝酒'],
    category: '食物'
  },
  // ── 补充：动物 ──
  { emoji: '🦊', name: '狐狸', keywords: ['fox', '狐狸', '狡猾', '动物'], category: '自然' },
  { emoji: '🐻', name: '熊', keywords: ['bear', '熊', '动物', '熊猫'], category: '自然' },
  { emoji: '🐼', name: '熊猫', keywords: ['panda', '熊猫', '国宝', '动物'], category: '自然' },
  { emoji: '🦁', name: '狮子', keywords: ['lion', '狮子', '动物', '勇猛'], category: '自然' },
  { emoji: '🐸', name: '青蛙', keywords: ['frog', '青蛙', '动物', '呱呱'], category: '自然' },
  { emoji: '🐷', name: '猪', keywords: ['pig', '猪', '动物', '小猪'], category: '自然' },
  { emoji: '🐔', name: '鸡', keywords: ['chicken', '鸡', '动物', '公鸡'], category: '自然' },
  {
    emoji: '🦄',
    name: '独角兽',
    keywords: ['unicorn', '独角兽', '神话', '梦幻'],
    category: '自然'
  },
  // ── 补充：植物与天气 ──
  { emoji: '🌵', name: '仙人掌', keywords: ['cactus', '仙人掌', '植物', '沙漠'], category: '自然' },
  {
    emoji: '🌻',
    name: '向日葵',
    keywords: ['sunflower', '向日葵', '花', '太阳花'],
    category: '自然'
  },
  // ── 补充：运动与娱乐 ──
  {
    emoji: '⚽',
    name: '足球',
    keywords: ['soccer', 'football', '足球', '运动', '踢球'],
    category: '活动'
  },
  { emoji: '🏀', name: '篮球', keywords: ['basketball', '篮球', '运动', '打球'], category: '活动' },
  {
    emoji: '🎸',
    name: '吉他',
    keywords: ['guitar', '吉他', '音乐', '乐器', '弹唱'],
    category: '物品'
  },
  {
    emoji: '🎹',
    name: '钢琴',
    keywords: ['piano', '钢琴', '音乐', '乐器', '弹奏'],
    category: '物品'
  },
  { emoji: '🎲', name: '骰子', keywords: ['dice', '骰子', '游戏', '随机', '掷'], category: '活动' },
  { emoji: '🧩', name: '拼图', keywords: ['puzzle', '拼图', '游戏', '积木'], category: '活动' },
  // ── 补充：物品与符号 ──
  {
    emoji: '🔒',
    name: '锁定',
    keywords: ['lock', '锁定', '上锁', '安全', '私密'],
    category: '符号'
  },
  { emoji: '🔑', name: '钥匙', keywords: ['key', '钥匙', '解锁', '密码'], category: '物品' },
  {
    emoji: '🥇',
    name: '金牌',
    keywords: ['gold medal', '金牌', '第一名', '冠军', '奖励'],
    category: '活动'
  },
  {
    emoji: '💎',
    name: '钻石',
    keywords: ['gem', 'diamond', '钻石', '宝石', '珍贵'],
    category: '符号'
  },
  {
    emoji: '📊',
    name: '柱状图',
    keywords: ['bar chart', '柱状图', '统计', '报表', '数据'],
    category: '物品'
  },
  { emoji: '🏦', name: '银行', keywords: ['bank', '银行', '存款', '金融'], category: '地点' },
  {
    emoji: '🚌',
    name: '公交车',
    keywords: ['bus', '公交车', '巴士', '交通', '出行'],
    category: '交通'
  },
  {
    emoji: '🗺️',
    name: '地图',
    keywords: ['map', '地图', '导航', '路线', '旅行'],
    category: '地点'
  },
  { emoji: '🧭', name: '指南针', keywords: ['compass', '指南针', '导航', '方向'], category: '物品' }
]

export interface EmojiTriggerMatch {
  /** `:` 后的关键词 */
  query: string
  /** `:` 在 text 中的下标（用于做替换） */
  start: number
}

/**
 * 解析「输入域内联 emoji」触发：取光标前最近一个 `:query`（query 不含空白与冒号）。
 * 匹配 `:fire` / `:开心`；不匹配 `http://x`（query 后出现冒号时向前找会被排除，
 * 此处以「紧邻光标前的最后一个冒号、其后无空白」为规则）。
 */
export function parseEmojiTrigger(text: string): EmojiTriggerMatch | null {
  const last = text.lastIndexOf(':')
  if (last < 0) return null
  const tail = text.slice(last + 1)
  // 关键词限字母/数字/下划线/连字符/中文（Unicode 属性），排除 URL、路径、时间等误触发
  if (!tail || tail.length > 24 || !/^[\p{L}\p{N}_-]{1,24}$/u.test(tail)) return null
  return { query: tail, start: last }
}

/** 搜索 Emoji */
export function searchEmoji(query: string, limit = 12): EmojiItem[] {
  const q = query.toLowerCase().trim()
  if (!q) return EMOJI_LIST.slice(0, limit)

  const scored = EMOJI_LIST.map((item) => {
    let score = 0
    // 名称匹配
    if (item.name.toLowerCase().includes(q)) score += 10
    // 关键词匹配
    for (const kw of item.keywords) {
      if (kw.toLowerCase() === q) score += 8
      else if (kw.toLowerCase().includes(q)) score += 4
    }
    // Emoji 本身匹配（用户直接输入 emoji）
    if (item.emoji === q) score += 100
    return { item, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item)
}
