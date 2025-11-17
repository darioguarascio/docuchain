import env from "@utils/env";

const baseUrl = env.PUBLIC_DOCUCHAIN_BACKEND_URL;

const getHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  return headers;
};

export const api = {
  get: async (endpoint: string, params?: Record<string, string | number>) => {
    let url = `${baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }
    const response = await fetch(url, {
      headers: getHeaders(),
      credentials: "include",
    });
    return response.json();
  },
  post: async (endpoint: string, data: any) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    });
    return response.json();
  },
  put: async (endpoint: string, data: any) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    });
    return response.json();
  },
  delete: async (endpoint: string, data?: any) => {
    const options: globalThis.RequestInit = {
      method: "DELETE",
      headers: getHeaders(),
      credentials: "include",
    };

    if (data !== undefined) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, options);
    return response.json();
  },
  postFormData: async (endpoint: string, formData: FormData) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    return response.json();
  },
  postBlob: async (
    endpoint: string,
    data: any,
  ): Promise<{ blob: Blob; headers: Headers }> => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    });
    const blob = await response.blob();
    return { blob, headers: response.headers };
  },
};
