from flask import Flask, jsonify, request
from flask_cors import CORS
import stripe
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Load environment variables
load_dotenv()

# Initialize Firebase Admin
cred = credentials.Certificate('firebase-service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

app = Flask(__name__)
CORS(app)

# Configure Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY')
STRIPE_PRICE_ID = os.getenv('STRIPE_PRICE_ID')
DOMAIN = os.getenv('DOMAIN')

@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': STRIPE_PRICE_ID,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'{DOMAIN}/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{DOMAIN}/cancel',
            metadata={
                'product': 'eli5_buddy_premium'
            }
        )
        return jsonify({'id': checkout_session.id})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/webhook', methods=['POST'])
def webhook():
    event = None
    payload = request.data
    sig_header = request.headers['STRIPE_SIGNATURE']

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv('STRIPE_WEBHOOK_SECRET')
        )
    except ValueError as e:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        return jsonify({'error': 'Invalid signature'}), 400

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_id = session.customer
        
        # Store subscription data in Firebase
        doc_ref = db.collection('subscriptions').document(customer_id)
        doc_ref.set({
            'status': 'active',
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'product': session.metadata.get('product')
        })

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription.customer
        
        # Update subscription status in Firebase
        doc_ref = db.collection('subscriptions').document(customer_id)
        doc_ref.update({
            'status': 'inactive',
            'updated_at': firestore.SERVER_TIMESTAMP
        })

    return jsonify({'status': 'success'})

@app.route('/check-subscription/<customer_id>', methods=['GET'])
def check_subscription(customer_id):
    try:
        doc_ref = db.collection('subscriptions').document(customer_id)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return jsonify({
                'status': data.get('status', 'inactive'),
                'created_at': data.get('created_at'),
                'updated_at': data.get('updated_at')
            })
        return jsonify({'status': 'inactive'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/success')
def success():
    return """
    <html>
        <body>
            <h1>Success!</h1>
            <p>Your subscription has been activated. You can close this window and return to the extension.</p>
            <script>
                // Send message to extension about successful subscription
                chrome.runtime.sendMessage(
                    '{YOUR_EXTENSION_ID}', 
                    {type: 'subscription_updated', status: 'active'}
                );
            </script>
        </body>
    </html>
    """

@app.route('/cancel')
def cancel():
    return 'Payment cancelled. You can close this window and try again.'

if __name__ == '__main__':
    app.run(port=5000) 