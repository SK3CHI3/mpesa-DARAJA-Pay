
import { consumerKey, consumerSecret } from './utils.ts';

// Function to get OAuth token - with enhanced error handling and diagnostics
export async function getOAuthToken() {
  // Try to get credentials from environment first
  let mpesaConsumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
  let mpesaConsumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
  
  // If env variables are not set, use the hardcoded values (for development only)
  if (!mpesaConsumerKey) {
    console.log('MPESA_CONSUMER_KEY not found in environment, using hardcoded value');
    mpesaConsumerKey = consumerKey;
  }
  
  if (!mpesaConsumerSecret) {
    console.log('MPESA_CONSUMER_SECRET not found in environment, using hardcoded value');
    mpesaConsumerSecret = consumerSecret;
  }
  
  if (!mpesaConsumerKey || !mpesaConsumerSecret) {
    console.error('Missing M-Pesa API credentials');
    throw new Error('Missing M-Pesa API credentials. Please check both hardcoded values and environment variables.');
  }
  
  console.log('Getting M-Pesa access token...');
  console.log('Consumer Key available:', !!mpesaConsumerKey);
  console.log('Consumer Secret available:', !!mpesaConsumerSecret);
  console.log('Using Consumer Key:', mpesaConsumerKey.substring(0, 5) + '...');
  
  try {
    // Create Base64 encoded auth string
    const credentials = btoa(`${mpesaConsumerKey}:${mpesaConsumerSecret}`);
    console.log('Credentials encoded successfully');
    
    console.log('Sending OAuth request to M-Pesa API...');
    // Production URL
    const authUrl = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
    console.log('Auth URL:', authUrl);
    
    const response = await fetch(authUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`
      }
    });
    
    console.log('M-Pesa OAuth response status:', response.status);
    console.log('M-Pesa OAuth response headers:', JSON.stringify(Object.fromEntries([...response.headers])));
    
    if (!response.ok) {
      console.error(`Failed to get access token: ${response.status} ${response.statusText}`);
      
      let errorText;
      try {
        errorText = await response.text();
        console.error(`Error response: ${errorText}`);
      } catch (e) {
        errorText = "Could not read error response body";
        console.error(`Error reading response: ${e}`);
      }
      
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }
    
    let data;
    try {
      data = await response.json();
      console.log('Successfully parsed OAuth response JSON');
    } catch (e) {
      console.error(`Error parsing OAuth response: ${e}`);
      const responseText = await response.text();
      console.error(`Response was: ${responseText}`);
      throw new Error(`Error parsing OAuth response: ${e}. Response text: ${responseText}`);
    }
    
    if (!data.access_token) {
      console.error('OAuth response did not contain access_token', data);
      throw new Error('OAuth response did not contain access_token');
    }
    
    console.log('Successfully got M-Pesa access token');
    return data.access_token;
  } catch (error) {
    console.error('Error getting M-Pesa access token:', error);
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}
