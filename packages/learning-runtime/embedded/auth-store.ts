export const useAuthStore = Object.assign((selector: any) => selector({user:null,token:null,loading:false}), {subscribe: () => () => {}, getState: () => ({user:null,token:null})})
