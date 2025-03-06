// Utility functions for M-Pesa API integration

// CORS headers for browser requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Business Shortcode (Your actual M-Pesa till/paybill number)
export const businessShortCode = '3315028';

// Passkey (Production passkey from Safaricom)
export const passkey = 'BSTqgZswZMDX3JxoD3ckC61lLGAFg2J4CJX9962ngNUdvShTHp5ODdg9aIbIGZWWZs7cvglFzz04gDlp8paJr4vPAnUob6VXHIWj/oT1IJdXtCaRX8dHSqA5QaZ4em6zjQTmPoAQkuaUDQppoLOawbslLGTEaBk4llaOmY6v3JjsNMEDghl5eRaISp0ox9iMZPtaR2xwRNt1+dmSm7oszN/Ydvs6BM7y7rbkCRkHX5KmU+GMYIEjwIq3d15scVT7HNyOMR8lWYd4lC8z8MFnu8zJPjT+mKnyaY0/9O7hSSkJjnm4aGM8cLtNiK9PBeauid1ErjqoAhpwMCZFke0FHg==';

// M-Pesa API credentials - for debugging purposes only, actual values come from env
export const consumerKey = 'Y4aAvrdocwyCCJ6QFz6ZVgZAmrpJUdiGyi9mc8mRF0zjgG0C';
export const consumerSecret = '8as7MlBoe9BIhE0xtki96hg6oyBFdlW4px6UCuTvIC7AJXVrAsg2uUnWCPUYwAZj';

// Function to generate timestamp in YYYYMMDDHHmmss format
export function getTimestamp(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

// Format phone number to ensure it's in the correct format for M-Pesa
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // If it starts with '0', replace with '254'
  if (digitsOnly.startsWith('0')) {
    return '254' + digitsOnly.substring(1);
  }
  
  // If it starts with '254', keep as is
  if (digitsOnly.startsWith('254')) {
    return digitsOnly;
  }
  
  // If it starts with '+254', remove the '+'
  if (phoneNumber.startsWith('+254')) {
    return phoneNumber.substring(1);
  }
  
  // Default case: assume it's a valid number and return as is
  return digitsOnly;
}

// Generate STK Push Password - this function creates the base64 password required by M-Pesa
export function generatePassword(timestamp: string): string {
  try {
    const passwordString = `${businessShortCode}${passkey}${timestamp}`;
    return btoa(passwordString);
  } catch (error) {
    console.error('Error generating password:', error);
    throw new Error('Failed to generate password for M-Pesa authentication');
  }
}
