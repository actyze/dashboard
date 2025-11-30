export const QUERY_CONFIG = {
  rest: {
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  },
  
  queries: {
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  },
};

export const getQueryConfig = (serviceType) => {
  return QUERY_CONFIG[serviceType] || QUERY_CONFIG.rest;
};

export default QUERY_CONFIG;

