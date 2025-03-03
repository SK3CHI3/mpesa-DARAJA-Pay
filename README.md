# M-Pesa Daraja API Integration 🚀  

A simple implementation of **M-Pesa STK Push** using **Daraja API** to process payments in Kenya.

## ⚡ Features  
- ✅ STK Push (Prompt users to enter PIN on their phone)  
- ✅ Secure authentication using **Consumer Key & Secret**  
- ✅ Generates **Base64 Password** for STK Push  
- ✅ Callback URL for real-time transaction updates  

---

## 🔧 Setup & Installation  

### 1️⃣ Clone the Repo  
```bash
git clone https://github.com/SK3CHI3/mpesa-DARAJA-Pay.git
cd mpesa-DARAJA-Pay
```

### 2️⃣ Set Up Environment Variables  
Create a `.env` file and add the following:

```env
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
CALLBACK_URL=https://your-callback-url.com/stk-callback
```

### 3️⃣ Install Dependencies  
```bash
npm install
```

### 4️⃣ Run the App  
```bash
node index.js
```

---

## 📌 API Endpoints  
- **STK Push Request** → `/stk-push` (Triggers M-Pesa payment request)  
- **STK Callback** → `/stk-callback` (Handles M-Pesa responses)  

---

## 📜 License  
MIT License. Feel free to use and contribute!  

---

🔥 Built by **SK3CHI3** 🚀  
