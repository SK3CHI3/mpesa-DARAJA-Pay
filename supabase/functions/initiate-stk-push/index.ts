
// Import required modules
import { serve } from "https://deno.land/std@0.140.0/http/server.ts"

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Business Shortcode (Test Paybill Number)
const businessShortCode = '174379'

// Passkey from Daraja API (Test environment)
const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'

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

// Generate STK Push Password
const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64')

// Function to get OAuth token
async function getOAuthToken() {
    if (!Deno.env.get('MPESA_CONSUMER_KEY') || !Deno.env.get('MPESA_CONSUMER_SECRET')) {
        throw new Error('Missing M-Pesa API credentials')
    }
    
    console.log('Getting M-Pesa access token...')
    
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')
    const credentials = btoa(`${consumerKey}:${consumerSecret}`)
    
    try {
        const response = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            method: "GET",
            headers: {
                "Authorization": `Basic ${credentials}`
            }
        })
        
        if (!response.ok) {
            console.error(`Failed to get access token: ${response.status} ${response.statusText}`)
            const errorText = await response.text()
            console.error(`Error response: ${errorText}`)
            throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`)
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

        const response = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        
        if (!response.ok) {
            console.error(`Failed to initiate STK Push: ${response.status} ${response.statusText}`)
            const errorText = await response.text()
            console.error(`Error response: ${errorText}`)
            throw new Error(`Failed to initiate STK Push: ${response.status} ${response.statusText}`)
        }
        
        const result = await response.json()
        console.log('STK Push initiated successfully:', result)
        return result
        
    } catch (error) {
        console.error('Error initiating STK Push:', error)
        throw new Error(`Failed to initiate STK Push: ${error.message}`)
    }
}

// Supabase Function to handle requests
serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }
    
    // Only accept POST requests
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
    
    try {
        // Parse request body
        const body = await req.json()
        const { phone, amount } = body
        
        // Validate request body
        if (!phone || !amount) {
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
