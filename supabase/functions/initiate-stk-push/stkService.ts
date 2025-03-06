
import { formatPhoneNumber, generatePassword, getTimestamp, businessShortCode } from './utils.ts';
import { getOAuthToken } from './auth.ts';

// Function to send STK Push
export async function sendSTKPush(phone: string, amount: number) {
  try {
    // Ensure phone number is properly formatted
    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Initiating STK Push for ${formattedPhone} with amount ${amount}`);
    
    const token = await getOAuthToken();
    console.log('Access token obtained successfully');
    
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);
    console.log('STK Push password generated successfully');

    // Callback URL (where M-Pesa sends transaction responses)
    const callBackURL = 'https://evghwzipbhnwhwkshumt.functions.supabase.co/stk-callback';

    const payload = {
      "BusinessShortCode": businessShortCode,
      "Password": password,
      "Timestamp": timestamp,
      "TransactionType": "CustomerPayBillOnline",
      "Amount": amount,
      "PartyA": formattedPhone, 
      "PartyB": businessShortCode,
      "PhoneNumber": formattedPhone,
      "CallBackURL": callBackURL,
      "AccountReference": "M-Pesa Simplicity",
      "TransactionDesc": "Payment for goods or services"
    };

    console.log('STK Push payload:', JSON.stringify(payload, null, 2));

    // Production URL
    const stkUrl = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
    console.log('STK Push URL:', stkUrl);
    
    const response = await fetch(stkUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`STK Push response status: ${response.status}`);
    
    let responseBody;
    try {
      responseBody = await response.text();
      console.log(`STK Push response body: ${responseBody}`);
    } catch (e) {
      console.error(`Error reading STK Push response: ${e}`);
      throw new Error(`Error reading STK Push response: ${e}`);
    }
    
    if (!response.ok) {
      console.error(`Failed to initiate STK Push: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to initiate STK Push: ${responseBody || response.statusText}`);
    }
    
    // Parse the response if it's JSON
    let result;
    try {
      result = JSON.parse(responseBody);
    } catch (e) {
      console.warn('Response is not valid JSON:', responseBody);
      return { success: true, rawResponse: responseBody };
    }
    
    console.log('STK Push initiated successfully:', result);
    return result;
    
  } catch (error) {
    console.error('Error initiating STK Push:', error);
    throw new Error(`Failed to initiate STK Push: ${error.message}`);
  }
}
