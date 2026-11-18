import axios from 'axios';
import type { Envelope } from './types';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1', timeout: 15000 });
api.interceptors.request.use(config => { const token = localStorage.getItem('gp-token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(r => r, error => { if (error.response?.status === 401) { localStorage.removeItem('gp-token'); localStorage.removeItem('gp-user'); if (location.pathname !== '/login') location.assign('/login'); } return Promise.reject(error); });
export async function get<T>(path: string, params?: object): Promise<T> { return (await api.get<Envelope<T>>(path, { params })).data.data; }
export async function post<T>(path: string, body: unknown): Promise<T> { return (await api.post<Envelope<T>>(path, body)).data.data; }
export function errorMessage(error: unknown) { return axios.isAxiosError(error) ? error.response?.data?.data?.error || error.response?.data?.message || error.message : 'Something went wrong. Please try again.'; }
