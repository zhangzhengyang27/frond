import axios from 'axios'

const service = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 15000,
  withCredentials: true
})

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    // 拦截器契约要求返回 AxiosResponse 形状；业务层自取 .data/.code 字段（既有约定）
    const res = response.data as unknown as typeof response
    return res
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default service
