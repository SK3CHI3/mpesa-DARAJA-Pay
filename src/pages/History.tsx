
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, LockKeyhole, Eye, EyeOff, RefreshCw } from "lucide-react";
import { supabase } from "@/App";

// PIN for accessing transaction history
// In a production app, this should be handled more securely
const ACCESS_PIN = "1234"; 

const History = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Verify PIN
  const verifyPin = () => {
    if (pin === ACCESS_PIN) {
      setAuthenticated(true);
      fetchTransactions();
      toast({
        title: "Access granted",
        description: "You can now view transaction history",
      });
    } else {
      toast({
        title: "Invalid PIN",
        description: "Please enter the correct PIN to access history",
        variant: "destructive",
      });
    }
  };

  // Fetch transactions from Supabase
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Failed to load transactions",
        description: error.message || "Could not load transaction history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle PIN input keydown event
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      verifyPin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-none">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-xl">Transaction History</CardTitle>
              <div className="w-5"></div> {/* Empty div for balanced layout */}
            </div>
            <CardDescription className="text-gray-100">
              View your M-Pesa payment records
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {!authenticated ? (
              <div className="space-y-6">
                <div className="text-center mb-4">
                  <LockKeyhole className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">Enter PIN to access transaction history</p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter PIN"
                      className="pr-10 text-center bg-gray-50"
                      maxLength={4}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPin(!showPin)}
                    >
                      {showPin ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <Button onClick={verifyPin}>Verify</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Recent Transactions</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchTransactions} 
                    disabled={loading}
                    className="flex items-center gap-1"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : transactions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {transactions.map((tx) => (
                      <div 
                        key={tx.id} 
                        className={`p-3 rounded-lg border ${
                          tx.status === 'success' 
                            ? 'bg-green-50 border-green-100' 
                            : tx.status === 'error' 
                              ? 'bg-red-50 border-red-100' 
                              : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">KES {tx.amount}</p>
                            <p className="text-sm text-gray-500">{tx.phone_number}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              tx.status === 'success' 
                                ? 'bg-green-100 text-green-800' 
                                : tx.status === 'error' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-gray-100 text-gray-800'
                            }`}>
                              {tx.status === 'success' ? 'Completed' : tx.status === 'error' ? 'Failed' : 'Pending'}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(tx.created_at)}
                            </p>
                          </div>
                        </div>
                        {tx.mpesa_receipt && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-500">Receipt: {tx.mpesa_receipt}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No transactions found</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-center pb-6 pt-2">
            {authenticated && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setAuthenticated(false);
                  setPin("");
                }}
              >
                Lock History
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Secure payments powered by M-Pesa</p>
        <p className="mt-1">© {new Date().getFullYear()} M-Pesa Simplicity</p>
      </div>
    </div>
  );
};

export default History;
