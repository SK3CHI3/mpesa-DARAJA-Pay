import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.4'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Format phone number to include country code if needed
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
  if (digitsOnly.startsWith('254')) {
    return digitsOnly
  }
  
  // Default case: assume it's a valid number and return as is
  return digitsOnly
}

// Get timestamp in the format YYYYMMDDHHmmss
function getTimestamp(): string {
  return new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14)
}

// Function to get M-Pesa access token
async function getMpesaAccessToken(): Promise<string> {
  const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY')
  const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('Missing M-Pesa API credentials')
  }
  
  console.log('Getting M-Pesa access token...')
  
  // Basic auth requires Base64 encoding of consumer key and secret
  const auth = btoa(`${consumerKey}:${consumerSecret}`)
  
  try {
    const response = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    )
    
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

// Function to initiate STK Push request
async function initiateSTKPush(
  phoneNumber: string,
  amount: string,
  accessToken: string
): Promise<any> {
  try {
    // Format phone number if needed
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber)
    
    // Business Shortcode - typically the same as the Paybill number
    const businessShortCode = '174379' // Safaricom test paybill
    
    // Get timestamp
    const timestamp = getTimestamp()
    
    // Create password (format: shortcode + passkey + timestamp)
    const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919' // Test environment passkey
    const password = btoa(businessShortCode + passkey + timestamp)
    
    console.log(`Initiating STK Push for ${formattedPhoneNumber} with amount ${amount}`)
    
    const response = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          BusinessShortCode: businessShortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: parseInt(amount, 10),
          PartyA: formattedPhoneNumber,
          PartyB: businessShortCode,
          PhoneNumber: formattedPhoneNumber,
          CallBackURL: 'https://evghwzipbhnwhwkshumt.functions.supabase.co/stk-callback',
          AccountReference: 'M-Pesa Simplicity',
          TransactionDesc: 'Payment for goods or services'
        })
      }
    )
    
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
    const { phoneNumber, amount, userId } = body
    
    // Validate request body
    if (!phoneNumber || !amount) {
      return new Response(
        JSON.stringify({ error: 'Phone number and amount are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    console.log(`Processing payment request: Phone=${phoneNumber}, Amount=${amount}, UserId=${userId || 'anonymous'}`)
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Step 1: Get M-Pesa access token
    const accessToken = await getMpesaAccessToken()
    
    // Step 2: Initiate STK Push
    const stkResponse = await initiateSTKPush(phoneNumber, amount, accessToken)
    
    // Step 3: Store transaction in database
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        phone_number: phoneNumber,
        amount: parseFloat(amount),
        user_id: userId || null, // Handle anonymous users
        status: 'pending'
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Error storing transaction:', insertError)
      throw new Error(`Failed to store transaction: ${insertError.message}`)
    }
    
    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK Push initiated successfully',
        checkoutRequestID: stkResponse.CheckoutRequestID,
        transactionId: transaction.id
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
