
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import PaymentForm from "@/components/payment/PaymentForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Payment form */}
        <PaymentForm />

        {/* History Link */}
        <div className="mt-4 text-center">
          <Link to="/history">
            <Button variant="outline" className="gap-2">
              <History className="h-4 w-4" />
              View Transaction History
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Secure payments powered by M-Pesa</p>
        <p className="mt-1">© {new Date().getFullYear()} M-Pesa Simplicity</p>
      </div>
    </div>
  );
};

export default Index;
