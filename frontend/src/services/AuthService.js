import { Network, apiInstance } from './network';

export class AuthService {
  static async login(username, password) {
    const endpoint = '/auth/login';
    
    // FastAPI OAuth2PasswordRequestForm expects form data
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      // Direct axios call to handle form-data
      const response = await apiInstance.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw Network.handleError(error);
    }
  }

  static async getCurrentUser() {
    const endpoint = '/auth/users/me';
    try {
      return await Network.get(endpoint);
    } catch (error) {
      console.error('Get current user failed:', error);
      throw error;
    }
  }

  static logout() {
    localStorage.removeItem('token');
    // Optional: Call backend logout if needed
  }
}

export default AuthService;

