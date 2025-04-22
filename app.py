from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import sqlite3
from datetime import datetime, timedelta
import socket
import bcrypt

app = Flask(__name__)
app.secret_key = 'your-secret-key'  # Replace with a secure random key in production
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id, email, name):
        self.id = id
        self.email = email
        self.name = name

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  email TEXT UNIQUE NOT NULL,
                  name TEXT NOT NULL,
                  password TEXT NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS expenses
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER,
                  amount REAL,
                  category TEXT,
                  date TEXT,
                  description TEXT,
                  FOREIGN KEY(user_id) REFERENCES users(id))''')
    conn.commit()
    conn.close()

init_db()

@login_manager.user_loader
def load_user(user_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    c.execute("SELECT id, email, name FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    conn.close()
    if user:
        return User(user[0], user[1], user[2])
    return None

# Routes
@app.route('/')
@login_required
def index():
    return render_template('index.html', user_name=current_user.name)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        conn = sqlite3.connect('expenses.db')
        c = conn.cursor()
        c.execute("SELECT id, email, name, password FROM users WHERE email = ?", (email,))
        user = c.fetchone()
        conn.close()
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user[3].encode('utf-8')):
            user_obj = User(user[0], user[1], user[2])
            login_user(user_obj)
            return jsonify({'status': 'success', 'redirect': url_for('index')})
        return jsonify({'status': 'error', 'message': 'Invalid email or password'}), 401
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        data = request.json
        email = data.get('email')
        name = data.get('name')
        password = data.get('password')
        
        if not email or not name or not password:
            return jsonify({'status': 'error', 'message': 'Email, name, and password are required'}), 400
        
        if len(name) > 50:
            return jsonify({'status': 'error', 'message': 'Name must be 50 characters or less'}), 400
        
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        try:
            conn = sqlite3.connect('expenses.db')
            c = conn.cursor()
            c.execute("INSERT INTO users (email, name, password) VALUES (?, ?, ?)", (email, name, hashed_password))
            conn.commit()
            user_id = c.lastrowid
            conn.close()
            
            user_obj = User(user_id, email, name)
            login_user(user_obj)
            return jsonify({'status': 'success', 'redirect': url_for('index')})
        except sqlite3.IntegrityError:
            return jsonify({'status': 'error', 'message': 'Email already exists'}), 400
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/add_expense', methods=['POST'])
@login_required
def add_expense():
    try:
        data = request.json
        amount = float(data['amount'])
        category = data['category']
        date = data['date']
        description = data.get('description', '')
        
        conn = sqlite3.connect('expenses.db')
        c = conn.cursor()
        c.execute("INSERT INTO expenses (user_id, amount, category, date, description) VALUES (?, ?, ?, ?, ?)",
                  (current_user.id, amount, category, date, description))
        conn.commit()
        expense_id = c.lastrowid
        conn.close()
        
        return jsonify({'status': 'success', 'id': expense_id})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/get_expenses', methods=['GET'])
@login_required
def get_expenses():
    try:
        period = request.args.get('period', 'daily')
        conn = sqlite3.connect('expenses.db')
        c = conn.cursor()
        
        if period == 'lifetime':
            c.execute("SELECT * FROM expenses WHERE user_id = ?", (current_user.id,))
        else:
            end_date = datetime.now()
            if period == 'daily':
                start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == 'weekly':
                start_date = end_date - timedelta(days=end_date.weekday())
                start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == 'monthly':
                start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            else:  # yearly
                start_date = end_date.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            
            c.execute("SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?",
                      (current_user.id, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')))
        
        expenses = [{'id': row[0], 'amount': row[2], 'category': row[3], 'date': row[4], 'description': row[5]}
                    for row in c.fetchall()]
        conn.close()
        
        return jsonify(expenses)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/update_expense/<int:id>', methods=['PUT'])
@login_required
def update_expense(id):
    try:
        data = request.json
        amount = float(data['amount'])
        category = data['category']
        date = data['date']
        description = data.get('description', '')
        
        conn = sqlite3.connect('expenses.db')
        c = conn.cursor()
        c.execute("UPDATE expenses SET amount = ?, category = ?, date = ?, description = ? WHERE id = ? AND user_id = ?",
                  (amount, category, date, description, id, current_user.id))
        if c.rowcount == 0:
            return jsonify({'status': 'error', 'message': 'Expense not found or not authorized'}), 404
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/delete_expense/<int:id>', methods=['DELETE'])
@login_required
def delete_expense(id):
    try:
        conn = sqlite3.connect('expenses.db')
        c = conn.cursor()
        c.execute("DELETE FROM expenses WHERE id = ? AND user_id = ?", (id, current_user.id))
        if c.rowcount == 0:
            return jsonify({'status': 'error', 'message': 'Expense not found or not authorized'}), 404
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

def find_available_port(host='127.0.0.1', start_port=5000, max_attempts=10):
    """Find an available port starting from start_port."""
    port = start_port
    for _ in range(max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((host, port))
                return port
        except OSError:
            port += 1
    raise Exception(f"No available ports found between {start_port} and {start_port + max_attempts - 1}")

if __name__ == '__main__':
    try:
        port = find_available_port()
        print(f"Starting Flask server on http://localhost:{port}")
        app.run(host='127.0.0.1', port=port, debug=True, use_reloader=False)
    except Exception as e:
        print(f"Failed to start server: {e}")