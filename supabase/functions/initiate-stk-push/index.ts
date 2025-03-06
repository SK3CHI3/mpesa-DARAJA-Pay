
// Import required modules
import { serve } from "https://deno.land/std@0.140.0/http/server.ts"

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Business Shortcode (Your actual M-Pesa till/paybill number)
const businessShortCode = '3315028'

// Passkey (Production passkey from Safaricom)
const passkey = 'BSTqgZswZMDX3JxoD3ckC61lLGAFg2J4CJX9962ngNUdvShTHp5ODdg9aIbIGZWWZs7cvglFzz04gDlp8paJr4vPAnUob6VXHIWj/oT1IJdXtCaRX8dHSqA5QaZ4em6zjQTmPoAQkuaUDQppoLOawbslLGTEaBk4llaOmY6v3JjsNMEDghl5eRaISp0ox9iMZPtaR2xwRNt1+dmSm7oszN/Ydvs6BM7y7rbkCRkHX5KmU+GMYIEjwIq3d15scVT7HNyOMR8lWYd4lC8z8MFnu8zJPjT+mKnyaY0/9O7hSSkJjnm4aGM8cLtNiK9PBeauid1ErjqoAhpwMCZFke0FHg=='

// M-Pesa API credentials - for debugging purposes only, actual values come from env
const consumerKey = 'Y4aAvrdocwyCCJ6QFz6ZVgZAmrpJUdiGyi9mc8mRF0zjgG0C'
const consumerSecret = '8as7MlBoe9BIhE0xtki96hg6oyBFdlW4px6UCuTvIC7AJXVrAsg2uUnWCPUYwAZj'

// Function to generate timestamp in YYYYMMDDHHmmss format
function getTimestamp(): string {
    const now = new Date()
    return now.getFullYear().toString() +
           String(now.getMonth() + 1).padStart(2, '0') +
           String(now.getDate()).padStart(2, '0') +
           String(now.getHours()).padStart(2, '0') +
           String(now.getMinutes()).padStart(2, '0') +
           String(now.getSeconds()).padStart(2, '0')
}

// Format phone number to ensure it's in the correct format for M-Pesa
function formatPhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '')
  
  // If it starts with '0', replace with '254'
  if (digitsOnly.startsWith('0')) {
    return '254' + digitsOnly.substring(1)
  }
  
  // If it starts with '254', keep as is
  if (digitsOnly.startsWith('254')) {
    return digitsOnly
  }
  
  // If it starts with '+254', remove the '+'
  if (phoneNumber.startsWith('+254')) {
    return phoneNumber.substring(1)
  }
  
  // Default case: assume it's a valid number and return as is
  return digitsOnly
}

// Generate Timestamp
const timestamp = getTimestamp()

// Generate STK Push Password - this function creates the base64 password required by M-Pesa
function generatePassword(): string {
  try {
    const passwordString = `${businessShortCode}${passkey}${timestamp}`
    return btoa(passwordString)
  } catch (error) {
    console.error('Error generating password:', error)
    throw new Error('Failed to generate password for M-Pesa authentication')
  }
}

// Function to get OAuth token
async function getOAuthToken() {
    // Try to get credentials from environment first
    let mpesaConsumerKey = Deno.env.get('MPESA_CONSUMER_KEY')
    let mpesaConsumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')
    
    // If env variables are not set, use the hardcoded values (for development only)
    if (!mpesaConsumerKey) {
        console.log('MPESA_CONSUMER_KEY not found in environment, using hardcoded value')
        mpesaConsumerKey = consumerKey
    }
    
    if (!mpesaConsumerSecret) {
        console.log('MPESA_CONSUMER_SECRET not found in environment, using hardcoded value')
        mpesaConsumerSecret = consumerSecret
    }
    
    if (!mpesaConsumerKey || !mpesaConsumerSecret) {
        console.error('Missing M-Pesa API credentials')
        throw new Error('Missing M-Pesa API credentials. Please check both hardcoded values and environment variables.')
    }
    
    console.log('Getting M-Pesa access token...')
    console.log('Consumer Key available:', !!mpesaConsumerKey)
    console.log('Consumer Secret available:', !!mpesaConsumerSecret)
    console.log('Using Consumer Key:', mpesaConsumerKey)
    
    const credentials = btoa(`${mpesaConsumerKey}:${mpesaConsumerSecret}`)
    
    try {
        console.log('Sending OAuth request to M-Pesa API...')
        // Production URL
        const response = await fetch("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            method: "GET",
            headers: {
                "Authorization": `Basic ${credentials}`
            }
        })
        
        console.log('M-Pesa OAuth response status:', response.status)
        
        if (!response.ok) {
            console.error(`Failed to get access token: ${response.status} ${response.statusText}`)
            const errorText = await response.text()
            console.error(`Error response: ${errorText}`)
            throw new Error(`Failed to get access token: ${response.status} ${response.statusText}. Details: ${errorText}`)
        }
        
        const data = await response.json()
        console.log('Successfully got M-Pesa access token')
        return data.access_token
    } catch (error) {
        console.error('Error getting M-Pesa access token:', error)
        throw new Error(`Failed to get access token: ${error.message}`)
    }
}

// Function to send STK Push
async function sendSTKPush(phone: string, amount: number) {
    try {
        // Ensure phone number is properly formatted
        const formattedPhone = formatPhoneNumber(phone)
        console.log(`Initiating STK Push for ${formattedPhone} with amount ${amount}`)
        
        const token = await getOAuthToken()
        const password = generatePassword()

        // Callback URL (where M-Pesa sends transaction responses)
        const callBackURL = 'https://evghwzipbhnwhwkshumt.functions.supabase.co/stk-callback'

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
        }

        console.log('STK Push payload:', JSON.stringify(payload, null, 2))

        // Production URL
        const response = await fetch("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        
        const responseBody = await response.text()
        console.log(`STK Push response status: ${response.status}`)
        console.log(`STK Push response body: ${responseBody}`)
        
        if (!response.ok) {
            console.error(`Failed to initiate STK Push: ${response.status} ${response.statusText}`)
            throw new Error(`Failed to initiate STK Push: ${responseBody || response.statusText}`)
        }
        
        // Parse the response if it's JSON
        let result
        try {
            result = JSON.parse(responseBody)
        } catch (e) {
            console.warn('Response is not valid JSON:', responseBody)
            return { success: true, rawResponse: responseBody }
        }
        
        console.log('STK Push initiated successfully:', result)
        return result
        
    } catch (error) {
        console.error('Error initiating STK Push:', error)
        throw new Error(`Failed to initiate STK Push: ${error.message}`)
    }
}

// Supabase Function to handle requests
serve(async (req: Request) => {
    console.log("Received request:", req.method, req.url)
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        console.log("Handling OPTIONS request for CORS")
        return new Response(null, { 
            status: 204,
            headers: corsHeaders 
        })
    }
    
    // Only accept POST requests
    if (req.method !== 'POST') {
        console.error("Method not allowed:", req.method)
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
    
    try {
        // Parse request body
        const body = await req.json()
        console.log("Request body:", body)
        
        const { phone, amount } = body
        
        // Validate request body
        if (!phone || !amount) {
            console.error("Invalid request: Missing phone or amount")
            return new Response(
                JSON.stringify({ error: 'Phone number and amount are required' }),
                { 
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }
        
        console.log(`Processing payment request: Phone=${phone}, Amount=${amount}`)
        
        // Send STK Push
        const stkResponse = await sendSTKPush(phone, amount)
        
        // Return response
        return new Response(
            JSON.stringify({
                success: true,
                message: 'STK Push initiated successfully',
                data: stkResponse
            }),
            { 
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
        
    } catch (error) {
        console.error('Error processing request:', error)
        
        return new Response(
            JSON.stringify({ error: `Internal server error: ${error.message}` }),
            { 
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
