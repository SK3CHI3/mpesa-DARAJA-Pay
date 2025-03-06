
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.4';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, updateTransactionStatus } from './utils.ts';

// Handle M-Pesa STK callback
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Parse the request body
    const body = await req.json();
    console.log('M-Pesa callback received:', JSON.stringify(body));
    
    // Extract the callback data
    const { Body } = body;
    
    if (!Body || !Body.stkCallback) {
      throw new Error('Invalid callback format');
    }
    
    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let mpesaReceiptNumber = null;
    let transactionAmount = null;
    
    // If transaction was successful, extract the receipt number and amount
    if (ResultCode === 0 && CallbackMetadata && CallbackMetadata.Item) {
      // Extract receipt number and amount from CallbackMetadata
      for (const item of CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') {
          mpesaReceiptNumber = item.Value;
        } else if (item.Name === 'Amount') {
          transactionAmount = item.Value;
        }
      }
      
      // Update transaction status in database
      await updateTransactionStatus(supabase, ResultCode, mpesaReceiptNumber);
    } else {
      console.log(`Transaction failed with ResultCode ${ResultCode}: ${ResultDesc}`);
      // Update as failed transaction
      await updateTransactionStatus(supabase, ResultCode, null);
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: 'Callback processed successfully' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
