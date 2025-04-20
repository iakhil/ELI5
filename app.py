from flask import Flask, jsonify, request, render_template, redirect, url_for
from flask_cors import CORS
import stripe
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth, firestore
import json
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Validate environment variables
if not os.getenv('STRIPE_SECRET_KEY'):
    raise ValueError("Missing STRIPE_SECRET_KEY in environment variables")
if not os.getenv('STRIPE_PUBLISHABLE_KEY'):
    raise ValueError("Missing STRIPE_PUBLISHABLE_KEY in environment variables")

# Initialize Firebase Admin with error handling
try:
    logger.info("Initializing Firebase Admin SDK...")
    cred = credentials.Certificate('backend/service_acc.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    # Test Firestore connection
    try:
        logger.info("Testing Firestore connection...")
        test_doc = db.collection('test_collection').document('test_document')
        test_doc.set({'test': 'data'})
        logger.info("Firestore connection successful!")
    except Exception as e:
        logger.error(f"Error connecting to Firestore: {str(e)}")
        logger.error("This may indicate that Firestore is not enabled for your project.")
        logger.error("Please visit the Firebase console and enable Firestore for this project.")
        if "403" in str(e) and "not been used" in str(e):
            logger.error("SOLUTION: Go to https://console.firebase.google.com/project/eli5-322a1/firestore")
            logger.error("and click 'Create database' to enable Firestore for this project.")
except Exception as e:
    logger.error(f"Firebase initialization error: {str(e)}")
    # Continue running the app even if Firebase fails
    db = None

app = Flask(__name__, template_folder='templates')
CORS(app)

# Configure Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY')
DOMAIN = os.getenv('DOMAIN', 'http://localhost:5001')

# Check if we're using test keys (for development)
is_test_mode = 'test' in stripe.api_key.lower()

# Print configuration (without exposing full keys)
logger.info("\nConfiguration:")
logger.info(f"Secret Key: {stripe.api_key[:8]}... ({'TEST MODE' if is_test_mode else 'LIVE MODE'})")
logger.info(f"Publishable Key: {STRIPE_PUBLISHABLE_KEY[:8]}...")
logger.info(f"Domain: {DOMAIN}")

# Authentication middleware with improved error handling
def require_auth(f):
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401
        
        try:
            # Verify Firebase token
            token = auth_header.split('Bearer ')[1]
            decoded_token = auth.verify_id_token(token)
            request.user = decoded_token
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
    decorated_function.__name__ = f.__name__  # Fix for route conflict
    return decorated_function

# Premium check middleware
def require_premium(f):
    @require_auth
    def decorated_function(*args, **kwargs):
        user_id = request.user['uid']
        
        # Allow access in test mode for easier testing
        if is_test_mode and request.args.get('test_premium') == 'true':
            logger.info(f"TEST MODE: Giving premium access to {user_id}")
            return f(*args, **kwargs)
            
        # Check if Firestore is available
        if db is None:
            logger.warning(f"Firestore unavailable - allowing premium access to {user_id} for testing")
            return f(*args, **kwargs)
        
        try:
            # Check if user has premium subscription
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
            
            user_data = user_doc.to_dict()
            subscription = user_data.get('subscription', {})
            
            if subscription.get('status') != 'active':
                return jsonify({'error': 'Premium subscription required', 'code': 'premium_required'}), 403
            
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error checking premium status: {str(e)}")
            # In case of error, allow access in test mode
            if is_test_mode:
                logger.warning(f"Firestore error - allowing premium access in test mode")
                return f(*args, **kwargs)
            return jsonify({'error': f'Error checking premium status: {str(e)}'}), 500
            
    decorated_function.__name__ = f.__name__  # Fix for route conflict
    return decorated_function

# Utility function to check premium status
def has_premium(user_id):
    # Always return True in test mode if requested
    if is_test_mode and request.args.get('test_premium') == 'true':
        return True
        
    # Handle case where Firestore is unavailable
    if db is None:
        logger.warning("Firestore unavailable - treating user as premium for testing")
        return True
        
    try:
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return False
            
        user_data = user_doc.to_dict()
        subscription = user_data.get('subscription', {})
        return subscription.get('status') == 'active'
    except Exception as e:
        logger.error(f"Error in has_premium check: {str(e)}")
        # In test mode, default to premium on error
        return is_test_mode

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/pricing')
def pricing():
    print(f"\nRendering pricing page with publishable key: {STRIPE_PUBLISHABLE_KEY[:8]}...")
    return render_template('pricing.html', stripe_publishable_key=STRIPE_PUBLISHABLE_KEY)

@app.route('/dashboard')
def dashboard():
    """Serve the dashboard page."""
    # Pass test mode information to the template
    return render_template('dashboard.html', 
                          test_mode=is_test_mode, 
                          stripe_publishable_key=STRIPE_PUBLISHABLE_KEY)

@app.route('/create-checkout-session', methods=['POST'])
@require_auth
def create_checkout_session():
    try:
        print("Creating checkout session...")
        print(f"API Key being used: {stripe.api_key[:8]}...")
        
        # Get user's email from Firebase token
        user_email = request.user['email']
        user_id = request.user['uid']
        
        print(f"Creating checkout for user: {user_email} (ID: {user_id})")
        
        # Create checkout session with subscription
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'ELI5 Buddy Premium',
                        'description': 'Monthly subscription to ELI5 Buddy Premium features'
                    },
                    'unit_amount': 499,  # $4.99 in cents
                    'recurring': {
                        'interval': 'month'
                    }
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'{DOMAIN}/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{DOMAIN}/cancel',
            customer_email=user_email,
            client_reference_id=user_id,
            metadata={
                'user_id': user_id,
                'user_email': user_email
            },
            subscription_data={
                'metadata': {
                    'user_id': user_id
                }
            }
        )
        
        print(f"Checkout session created successfully: {checkout_session.id}")
        print(f"URL: {checkout_session.url}")
        
        return jsonify({
            'id': checkout_session.id,
            'url': checkout_session.url
        })
    except stripe.error.StripeError as e:
        print(f"Stripe Error: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        return jsonify({'error': str(e)}), 400

# API Endpoints for Flashcards
@app.route('/api/flashcards', methods=['GET'])
@require_auth
@require_premium
def get_flashcards():
    """Retrieve user's flashcards from Firestore."""
    try:
        # Get user ID from authenticated request
        user_id = request.user['uid']
        
        # Access Firestore
        db = firestore.client()
        
        # Get user's flashcards collection
        flashcards_ref = db.collection('users').document(user_id).collection('flashcards')
        flashcards = flashcards_ref.stream()
        
        # Convert to list of dictionaries
        flashcards_list = []
        for card in flashcards:
            card_data = card.to_dict()
            card_data['id'] = card.id  # Add document ID
            flashcards_list.append(card_data)
        
        return jsonify({
            'success': True,
            'flashcards': flashcards_list
        })
    
    except Exception as e:
        app.logger.error(f"Get flashcards error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/flashcards', methods=['POST'])
@require_auth
@require_premium
def create_flashcard():
    """Create a new flashcard."""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('front') or not data.get('back'):
            return jsonify({'error': 'Front and back are required'}), 400
        
        # Create flashcard object
        flashcard = {
            'front': data.get('front'),
            'back': data.get('back'),
            'category': data.get('category', 'General'),
            'created_at': int(time.time())
        }
        
        # Get user ID from authenticated request
        user_id = request.user['uid']
        
        # Save to Firestore
        db = firestore.client()
        flashcard_ref = db.collection('users').document(user_id).collection('flashcards').add(flashcard)
        
        # Return the created flashcard with ID
        flashcard['id'] = flashcard_ref[1].id
        
        return jsonify({
            'success': True,
            'flashcard': flashcard
        })
    
    except Exception as e:
        app.logger.error(f"Create flashcard error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-flashcards', methods=['POST'])
@require_auth
@require_premium
def generate_flashcards():
    """Generate flashcards based on provided text using AI."""
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text or len(text) < 20:
            return jsonify({'error': 'Text too short. Please provide more content.'}), 400
        
        # Limit text length for the API call
        if len(text) > 5000:
            text = text[:5000]
            
        # Get user ID from authenticated request
        user_id = request.user['uid']
        
        try:
            # Generate flashcards using OpenAI
            # In a production environment, you'd use the OpenAI API or similar service
            # For demo purposes, we'll create some sample flashcards
            
            # Simulate AI generation delay
            time.sleep(1.5)
            
            # Sample flashcards based on content (in production, use actual AI generation)
            sample_flashcards = [
                {
                    "front": "What is the main purpose of ELI5?",
                    "back": "To explain complex concepts in simple terms that a 5-year-old could understand.",
                    "category": "General",
                    "created_at": int(time.time())
                },
                {
                    "front": "What does ELI5 stand for?",
                    "back": "Explain Like I'm 5",
                    "category": "Terminology",
                    "created_at": int(time.time())
                },
                {
                    "front": "What is the benefit of using flashcards?",
                    "back": "Flashcards use active recall and spaced repetition to enhance learning and memory retention.",
                    "category": "Learning",
                    "created_at": int(time.time())
                }
            ]
            
            # Save flashcards to Firestore
            db = firestore.client()
            
            # Get user document reference
            user_ref = db.collection('users').document(user_id)
            
            # Add flashcards to user's collection
            flashcards_ref = user_ref.collection('flashcards')
            
            for card in sample_flashcards:
                flashcards_ref.add(card)
                
            # Update user statistics
            user_doc = user_ref.get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                current_count = user_data.get('flashcards_generated', 0)
                user_ref.update({
                    'flashcards_generated': current_count + len(sample_flashcards),
                    'last_generation': firestore.SERVER_TIMESTAMP
                })
            
            return jsonify({
                'success': True,
                'flashcards': sample_flashcards,
                'message': f'Generated {len(sample_flashcards)} flashcards successfully'
            })
            
        except Exception as e:
            app.logger.error(f"Error generating flashcards: {str(e)}")
            return jsonify({'error': f'Failed to generate flashcards: {str(e)}'}), 500
    
    except Exception as e:
        app.logger.error(f"Generate flashcards request error: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/user/subscription', methods=['GET'])
@require_auth
def get_subscription_status():
    """Get user's subscription status."""
    try:
        # Get user ID from authenticated request
        user_id = request.user['uid']
        
        # For testing purposes, check for test_premium parameter
        test_premium = request.args.get('test_premium', 'false').lower() == 'true'
        logger.info(f"Subscription check for user {user_id}, test_premium param: {test_premium}")
        
        # Return diagnostic information about how the status is determined
        status_source = "unknown"
        
        # Check if we're in test mode
        if is_test_mode:
            logger.info(f"Running in test mode, testing parameter value: {test_premium}")
            
        if is_test_mode and test_premium:
            logger.info(f"TEST MODE: Returning premium status for {user_id}")
            status_source = "test_mode_param"
            return jsonify({
                'isPremium': True,
                'subscription': {
                    'status': 'active',
                    'plan': 'premium',
                    'periodEnd': int(time.time()) + 30 * 24 * 60 * 60  # 30 days from now
                },
                'status_source': status_source,
                'is_test_mode': is_test_mode
            })
        
        # Check if Firestore is available
        if db is None:
            logger.warning(f"Firestore unavailable during subscription check for {user_id}")
            
            # In test mode, return premium status
            if is_test_mode:
                logger.info("Returning test premium status due to Firestore unavailability")
                status_source = "firestore_unavailable_test_mode"
                return jsonify({
                    'isPremium': True,
                    'subscription': {
                        'status': 'active',
                        'plan': 'premium',
                        'periodEnd': int(time.time()) + 30 * 24 * 60 * 60  # 30 days from now
                    },
                    'note': 'Firestore unavailable - using test data',
                    'status_source': status_source,
                    'is_test_mode': is_test_mode
                })
            else:
                status_source = "firestore_unavailable"
                return jsonify({
                    'isPremium': False,
                    'error': 'Firestore service unavailable',
                    'errorCode': 'firestore_unavailable',
                    'status_source': status_source,
                    'is_test_mode': is_test_mode
                }), 503
        
        try:
            # Access Firestore
            # Get user document
            user_ref = db.collection('users').document(user_id)
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                status_source = "no_user_doc"
                return jsonify({
                    'isPremium': False, 
                    'status_source': status_source,
                    'is_test_mode': is_test_mode
                }), 404
                
            user_data = user_doc.to_dict()
            logger.info(f"User data for {user_id}: {user_data.keys()}")
            
            # Check if user has active subscription
            subscription = user_data.get('subscription', {})
            is_premium = subscription.get('status') == 'active'
            
            logger.info(f"User {user_id} premium status: {is_premium}, subscription status: {subscription.get('status', 'none')}")
            
            # For testing in development, also check the URL parameter
            if is_test_mode and 'test_premium' in request.args and request.args.get('test_premium') == 'true':
                is_premium = True
                status_source = "test_param_override"
                logger.info(f"Forcing premium status to true based on request parameter")
            else:
                status_source = "firestore_data"
            
            return jsonify({
                'isPremium': is_premium,
                'subscription': subscription,
                'status_source': status_source,
                'is_test_mode': is_test_mode,
                'user_exists': True
            })
        except Exception as firestore_error:
            logger.error(f"Firestore error during subscription check: {str(firestore_error)}")
            
            # In test mode, return premium status on error
            if is_test_mode:
                status_source = "firestore_error_test_mode"
                return jsonify({
                    'isPremium': True,
                    'subscription': {
                        'status': 'active',
                        'plan': 'premium',
                        'periodEnd': int(time.time()) + 30 * 24 * 60 * 60  # 30 days from now
                    },
                    'note': 'Error accessing Firestore - using test data',
                    'status_source': status_source,
                    'is_test_mode': is_test_mode,
                    'error': str(firestore_error)
                })
            else:
                status_source = "firestore_error"
                return jsonify({
                    'isPremium': False,
                    'error': f'Database error: {str(firestore_error)}',
                    'errorCode': 'database_error',
                    'status_source': status_source,
                    'is_test_mode': is_test_mode
                }), 500
            
    except Exception as e:
        logger.error(f"Get subscription status error: {str(e)}")
        return jsonify({
            'error': str(e), 
            'isPremium': False,
            'status_source': 'general_error',
            'is_test_mode': is_test_mode
        }), 500

@app.route('/create-portal-session', methods=['POST'])
@require_auth
def create_portal_session():
    try:
        user_id = request.user['uid']
        print(f"Creating portal session for user: {user_id}")
        
        # Get user's subscription from Firestore
        db = firestore.client()
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            print(f"Error: User document not found for {user_id}")
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        print(f"User data: {user_data.keys()}")
        
        # Check for Stripe customer ID
        stripe_customer_id = user_data.get('stripe_customer_id')
        
        if not stripe_customer_id:
            print(f"Error: No stripe_customer_id found for {user_id}")
            return jsonify({'error': 'No subscription found'}), 404
        
        print(f"Creating portal session for customer: {stripe_customer_id}")
        
        # Create Stripe portal session
        session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=f'{DOMAIN}/dashboard'
        )
        
        print(f"Portal session created: {session.url}")
        return jsonify({'url': session.url})
    except Exception as e:
        print(f"Error creating portal session: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/success')
def success():
    # Check if we have a session_id
    session_id = request.args.get('session_id')
    
    if session_id:
        print(f"Success page with session_id: {session_id}")
        try:
            # Retrieve the session
            session = stripe.checkout.Session.retrieve(session_id)
            
            # Get user ID from metadata
            user_id = session.metadata.get('user_id')
            
            if user_id:
                # Manually update the subscription in Firestore
                # This is a backup in case the webhook didn't trigger
                try:
                    # Get customer and subscription IDs
                    customer_id = session.customer
                    subscription_id = session.subscription
                    
                    if subscription_id:
                        subscription = stripe.Subscription.retrieve(subscription_id)
                        status = subscription.status
                        current_period_end = subscription.current_period_end
                        
                        print(f"Manually updating subscription for user {user_id}")
                        print(f"Status: {status}, Customer: {customer_id}, Sub: {subscription_id}")
                        
                        # Update user document
                        db = firestore.client()
                        db.collection('users').document(user_id).update({
                            'stripe_customer_id': customer_id,
                            'subscription': {
                                'status': status,
                                'plan': 'premium',
                                'stripe_subscription_id': subscription_id,
                                'currentPeriodEnd': current_period_end,
                                'created_at': firestore.SERVER_TIMESTAMP,
                                'updated_at': firestore.SERVER_TIMESTAMP
                            }
                        })
                        
                        print(f"Successfully updated subscription status for user: {user_id}")
                except Exception as e:
                    print(f"Error updating subscription: {str(e)}")
                    # Still show success but log the error
        except Exception as e:
            print(f"Error retrieving session: {str(e)}")
    
    return render_template('success.html', redirect_url='/dashboard')

@app.route('/cancel')
def cancel():
    return """
    <html>
        <body>
            <h1>Payment Cancelled</h1>
            <p>You can close this window and try again.</p>
            <script>
                setTimeout(function() {
                    window.location.href = '/dashboard';
                }, 3000); // Redirect after 3 seconds
            </script>
        </body>
    </html>
    """

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/extension_popup.html')
def extension_popup():
    """Serve the extension popup HTML."""
    return render_template('extension_popup.html')

# Webhook handler for Stripe events
@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')
    
    webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
    print(f"Received webhook. Secret available: {webhook_secret is not None}")

    try:
        # If testing and no webhook secret is set, skip signature verification
        if is_test_mode and not webhook_secret:
            event = json.loads(payload)
            print("TEST MODE: Skipping signature verification")
        else:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        
        print(f"Webhook event type: {event['type']}")
    except ValueError as e:
        print(f"Webhook error: Invalid payload - {str(e)}")
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        print(f"Webhook error: Invalid signature - {str(e)}")
        return jsonify({'error': 'Invalid signature'}), 400
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return jsonify({'error': str(e)}), 400

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        print(f"Checkout completed. Session ID: {session.get('id')}")
        print(f"Customer ID: {session.get('customer')}")
        print(f"Subscription ID: {session.get('subscription')}")
        
        # Get user_id from metadata
        user_id = session.get('metadata', {}).get('user_id')
        
        if not user_id:
            print("Error: No user_id in session metadata")
            return jsonify({'error': 'No user_id in metadata'}), 400
            
        print(f"Updating subscription for user: {user_id}")
        
        # Fetch subscription details
        try:
            subscription = stripe.Subscription.retrieve(session.get('subscription'))
            current_period_end = subscription.current_period_end
            status = subscription.status
            
            print(f"Subscription status: {status}")
            print(f"Current period end: {current_period_end}")
            
            # Update user's subscription status in Firestore
            db.collection('users').document(user_id).update({
                'stripe_customer_id': session.get('customer'),
                'subscription': {
                    'status': status,
                    'plan': 'premium',
                    'stripe_subscription_id': session.get('subscription'),
                    'currentPeriodEnd': current_period_end,
                    'created_at': firestore.SERVER_TIMESTAMP,
                    'updated_at': firestore.SERVER_TIMESTAMP
                }
            })
            
            print(f"Successfully updated subscription for user: {user_id}")
        except Exception as e:
            print(f"Error updating user subscription: {str(e)}")
            return jsonify({'error': str(e)}), 500
            
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        
        # In actual webhook from Stripe, metadata is on the customer, not subscription
        # We need to retrieve the customer to get the metadata
        try:
            customer = stripe.Customer.retrieve(subscription.get('customer'))
            # Try to find user from our database based on customer ID
            user_docs = db.collection('users').where('stripe_customer_id', '==', customer.id).limit(1).get()
            
            if not user_docs:
                print(f"No user found for customer: {customer.id}")
                return jsonify({'error': 'User not found'}), 404
                
            user_id = user_docs[0].id
            
            print(f"Subscription updated for user: {user_id}")
            print(f"New status: {subscription.get('status')}")
            
            # Update subscription status in Firestore
            db.collection('users').document(user_id).update({
                'subscription': {
                    'status': subscription.get('status'),
                    'currentPeriodEnd': subscription.get('current_period_end'),
                    'updated_at': firestore.SERVER_TIMESTAMP
                }
            })
            
            print(f"Successfully updated subscription status for user: {user_id}")
        except Exception as e:
            print(f"Error updating subscription status: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        
        try:
            # Find user with this subscription ID
            user_docs = db.collection('users').where('subscription.stripe_subscription_id', '==', subscription.id).limit(1).get()
            
            if not user_docs:
                print(f"No user found for subscription: {subscription.id}")
                return jsonify({'error': 'User not found'}), 404
                
            user_id = user_docs[0].id
            
            print(f"Subscription cancelled for user: {user_id}")
            
            # Update subscription status in Firestore
            db.collection('users').document(user_id).update({
                'subscription': {
                    'status': 'cancelled',
                    'cancelled_at': firestore.SERVER_TIMESTAMP,
                    'updated_at': firestore.SERVER_TIMESTAMP
                }
            })
            
            print(f"Successfully updated subscription status to cancelled for user: {user_id}")
        except Exception as e:
            print(f"Error handling subscription cancellation: {str(e)}")
            return jsonify({'error': str(e)}), 500

    # Return a success response
    return jsonify({'status': 'success'})

@app.route('/api/explain', methods=['POST'])
def explain_text():
    """Generate a simple explanation for the provided text."""
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text or len(text) < 10:
            return jsonify({'error': 'Text too short. Please provide more content.'}), 400
        
        # Limit text length for the API call
        if len(text) > 5000:
            text = text[:5000]
        
        # Get user ID if authenticated
        user_id = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].replace('Bearer ', '')
            try:
                decoded_token = auth.verify_id_token(token)
                user_id = decoded_token['uid']
            except Exception as e:
                app.logger.warning(f"Invalid token in /explain: {str(e)}")
                # Continue without user_id - explanation works for non-authenticated users too
        
        # In a production environment, you'd use OpenAI or another AI service
        # For demo purposes, we'll create a simple explanation
        
        # Simulate AI delay
        time.sleep(1)
        
        # Create a simple explanation
        if len(text) < 100:
            explanation = f"Simply put: {text}"
        else:
            first_sentence = text.split('. ')[0] + '.'
            explanation = f"In simple terms, this is about {first_sentence} The key idea is to understand this concept as if explaining to a 5-year-old."
        
        # If user is authenticated, save to history
        if user_id:
            try:
                db = firestore.client()
                history_ref = db.collection('users').document(user_id).collection('explanation_history')
                
                history_item = {
                    'original_text': text[:500] + ('...' if len(text) > 500 else ''),
                    'explanation': explanation,
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'source': 'extension'
                }
                
                history_ref.add(history_item)
                
                # Update user statistics
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    current_count = user_data.get('explanations_generated', 0)
                    user_ref.update({
                        'explanations_generated': current_count + 1,
                        'last_explanation': firestore.SERVER_TIMESTAMP
                    })
            except Exception as e:
                app.logger.error(f"Error saving explanation history: {str(e)}")
                # Continue without saving history - don't fail the request
        
        return jsonify({
            'explanation': explanation,
            'original_text_length': len(text)
        })
    
    except Exception as e:
        app.logger.error(f"Explanation error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-token', methods=['GET'])
@require_auth
def verify_token():
    """Verify that a token is valid."""
    return jsonify({'valid': True})

@app.route('/diagnostic')
def diagnostic():
    """Serve the diagnostic page for troubleshooting subscription issues."""
    return render_template('diagnostic.html')

@app.route('/api/fix-subscription', methods=['POST'])
@require_auth
def fix_subscription():
    """Manually fix user subscription in Firestore based on Stripe data."""
    try:
        user_id = request.user['uid']
        print(f"Attempting to fix subscription for user: {user_id}")
        
        # Get user from Firestore
        db_client = firestore.client()
        user_doc = db_client.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'success': False, 'error': 'User not found in Firestore'}), 404
            
        user_data = user_doc.to_dict()
        print(f"User data: {user_data.keys()}")
        
        # Check for Stripe customer ID
        stripe_customer_id = user_data.get('stripe_customer_id')
        
        if not stripe_customer_id:
            print(f"No Stripe customer ID found for user {user_id}")
            
            # Try to find customer in Stripe by email
            try:
                customers = stripe.Customer.list(email=request.user['email'], limit=1)
                if customers and customers.data:
                    stripe_customer_id = customers.data[0].id
                    print(f"Found Stripe customer by email: {stripe_customer_id}")
                else:
                    return jsonify({
                        'success': False,
                        'error': 'No Stripe customer found'
                    }), 404
            except Exception as e:
                print(f"Error finding Stripe customer: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': f'Error finding Stripe customer: {str(e)}'
                }), 500
        
        # Find active subscriptions for this customer
        try:
            subscriptions = stripe.Subscription.list(
                customer=stripe_customer_id,
                status='active',
                limit=1
            )
            
            if not subscriptions or not subscriptions.data:
                # Try to find any subscription (including past ones)
                subscriptions = stripe.Subscription.list(
                    customer=stripe_customer_id,
                    limit=1
                )
                
                if not subscriptions or not subscriptions.data:
                    return jsonify({
                        'success': False,
                        'error': 'No subscriptions found for this customer'
                    }), 404
            
            print(f"Found subscription: {subscriptions.data[0].id}")
            
            # Get the subscription
            subscription = subscriptions.data[0]
            subscription_id = subscription.id
            status = subscription.status
            current_period_end = subscription.current_period_end
            
            # Update user in Firestore
            db_client.collection('users').document(user_id).update({
                'stripe_customer_id': stripe_customer_id,
                'subscription': {
                    'status': status,
                    'plan': 'premium',
                    'stripe_subscription_id': subscription_id,
                    'currentPeriodEnd': current_period_end,
                    'created_at': firestore.SERVER_TIMESTAMP,
                    'updated_at': firestore.SERVER_TIMESTAMP
                }
            })
            
            print(f"Successfully fixed subscription for user {user_id}")
            
            return jsonify({
                'success': True,
                'message': 'Subscription fixed successfully',
                'customer_id': stripe_customer_id,
                'subscription_id': subscription_id,
                'status': status
            })
            
        except Exception as e:
            print(f"Error fixing subscription: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Error fixing subscription: {str(e)}'
            }), 500
            
    except Exception as e:
        print(f"Fix subscription error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/quickfix')
def quickfix():
    """A simple page to enable premium mode with local storage."""
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ELI5 Buddy - Quick Fix</title>
        <style>
            body {
                font-family: 'Nunito', sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                line-height: 1.6;
                color: #333;
            }
            .card {
                background: #fff;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .btn {
                background: #4285f4;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin-top: 20px;
            }
            .success-message {
                color: green;
                font-weight: bold;
                display: none;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <h1>ELI5 Buddy - Quick Fix</h1>
        
        <div class="card">
            <h2>Enable Premium Mode Locally</h2>
            <p>This will enable premium features in your browser by setting a local flag.</p>
            <p><strong>Note:</strong> This is a temporary fix while your Firebase setup completes.</p>
            
            <button id="enablePremium" class="btn">Enable Premium Mode</button>
            <div id="successMessage" class="success-message">
                Premium mode enabled! <a href="/dashboard">Return to dashboard</a>
            </div>
        </div>
        
        <script>
            document.getElementById('enablePremium').addEventListener('click', function() {
                // Set local storage flag for premium status
                localStorage.setItem('eli5_premium_override', 'true');
                localStorage.setItem('eli5_premium_timestamp', Date.now());
                
                // Show success message
                document.getElementById('successMessage').style.display = 'block';
                
                // Disable button
                this.disabled = true;
                this.textContent = 'Premium Mode Enabled';
            });
        </script>
    </body>
    </html>
    """

@app.route('/firebase-setup')
def firebase_setup():
    """Page with instructions on how to set up Firebase properly."""
    firebase_status = {
        'initialized': True,
        'firestore_available': db is not None
    }
    
    # Check Firebase connection if we can
    firestore_error = None
    if firebase_status['initialized']:
        try:
            if db is not None:
                test_doc = db.collection('test_collection').document('test_document')
                test_doc.set({'test': 'data', 'timestamp': firestore.SERVER_TIMESTAMP})
                firebase_status['firestore_working'] = True
            else:
                firebase_status['firestore_working'] = False
        except Exception as e:
            firebase_status['firestore_working'] = False
            firestore_error = str(e)
    
    # Read service account for project ID
    project_id = None
    try:
        with open('backend/service_acc.json', 'r') as f:
            service_acc = json.load(f)
            project_id = service_acc.get('project_id')
    except Exception as e:
        logger.error(f"Error reading service account: {str(e)}")
    
    return render_template('firebase_setup.html', 
                          firebase_status=firebase_status,
                          firestore_error=firestore_error,
                          project_id=project_id)

@app.route('/create-user-document')
@require_auth
def create_user_document():
    """Create or update user document in Firestore."""
    user_id = request.user['uid']
    user_email = request.user['email']
    
    try:
        if db is None:
            return """
            <html>
                <head>
                    <title>Firestore Not Connected</title>
                    <style>
                        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                        .error { color: red; }
                        .card { background: #f9f9f9; border-radius: 5px; padding: 20px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <h1>Firestore Not Connected</h1>
                    <div class="error card">
                        <p>Firestore database is not connected. Please follow these steps:</p>
                        <ol>
                            <li>Visit the <a href="/firebase-setup">Firebase Setup Guide</a></li>
                            <li>Enable Firestore for your project</li>
                            <li>Restart your application</li>
                            <li>Try again</li>
                        </ol>
                    </div>
                    <p><a href="/dashboard">Return to Dashboard</a></p>
                </body>
            </html>
            """
        
        # Check if user document already exists
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            existing_fields = ', '.join(user_data.keys())
            
            # Determine if we need to add subscription data
            if 'subscription' not in user_data:
                logger.info(f"Adding subscription object to existing user document for {user_id}")
                user_ref.update({
                    'subscription': {
                        'status': 'active',  # Set to active for test purposes
                        'plan': 'premium',
                        'currentPeriodEnd': int(time.time() + 30 * 24 * 60 * 60),  # 30 days from now
                        'updated_at': firestore.SERVER_TIMESTAMP
                    },
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                result = "Updated existing user document with subscription data"
            else:
                result = f"User document already exists with fields: {existing_fields}"
        else:
            # Create new user document
            logger.info(f"Creating new user document for {user_id}")
            user_ref.set({
                'email': user_email,
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP,
                'explanations_generated': 0,
                'flashcards_generated': 0,
                'subscription': {
                    'status': 'active',  # Set to active for test purposes
                    'plan': 'premium',
                    'currentPeriodEnd': int(time.time() + 30 * 24 * 60 * 60),  # 30 days from now
                    'created_at': firestore.SERVER_TIMESTAMP
                }
            })
            result = "Created new user document with initial data"
        
        return f"""
        <html>
            <head>
                <title>User Document Created</title>
                <style>
                    body {{ font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
                    .success {{ color: green; }}
                    .card {{ background: #f9f9f9; border-radius: 5px; padding: 20px; margin: 20px 0; }}
                    .btn {{ background: #4285f4; color: white; padding: 10px 15px; border-radius: 4px; 
                           text-decoration: none; display: inline-block; margin-top: 10px; }}
                </style>
                <meta http-equiv="refresh" content="3;url=/dashboard" />
            </head>
            <body>
                <h1>User Document Status</h1>
                <div class="success card">
                    <p>{result}</p>
                    <p>User ID: {user_id}</p>
                    <p>Email: {user_email}</p>
                </div>
                <p>Redirecting to dashboard in 3 seconds...</p>
                <p><a href="/dashboard" class="btn">Return to Dashboard Now</a></p>
            </body>
        </html>
        """
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error creating user document: {error_message}")
        return f"""
        <html>
            <head>
                <title>Error</title>
                <style>
                    body {{ font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
                    .error {{ color: red; }}
                    .card {{ background: #f9f9f9; border-radius: 5px; padding: 20px; margin: 20px 0; }}
                </style>
            </head>
            <body>
                <h1>Error Creating User Document</h1>
                <div class="error card">
                    <p>Error: {error_message}</p>
                </div>
                <p>Please visit the <a href="/firebase-setup">Firebase Setup Guide</a> to troubleshoot.</p>
                <p><a href="/dashboard">Return to Dashboard</a></p>
            </body>
        </html>
        """

if __name__ == '__main__':
    app.run(port=5001, debug=True) 