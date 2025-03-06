
// CORS headers for browser requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to handle database operations
export async function updateTransactionStatus(supabase, resultCode, mpesaReceiptNumber) {
  // Find the most recent pending transaction
  const { data: transactions, error: queryError } = await supabase
    .from('transactions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (queryError) {
    console.error('Error finding transaction:', queryError);
    throw new Error(`Database error: ${queryError.message}`);
  }
  
  if (transactions && transactions.length > 0) {
    const transaction = transactions[0];
    
    // Update transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: resultCode === 0 ? 'completed' : 'failed',
        mpesa_receipt: mpesaReceiptNumber
      })
      .eq('id', transaction.id);
    
    if (updateError) {
      console.error('Error updating transaction:', updateError);
      throw new Error(`Database error: ${updateError.message}`);
    }
    
    console.log(`Transaction ${transaction.id} updated to ${resultCode === 0 ? 'completed' : 'failed'}`);
    return transaction.id;
  } else {
    console.warn('No pending transaction found to update');
    return null;
  }
}
