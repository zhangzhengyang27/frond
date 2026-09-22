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
    const res = response.data
    return res
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default service
