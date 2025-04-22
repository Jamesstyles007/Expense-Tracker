let pieChart, barChart;

// Ensure the script runs only in a browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Set default date to today for add/edit forms
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        
        // Initialize expenses if on the main page
        if (document.getElementById('expenseList')) {
            fetchExpenses();
            setInterval(fetchExpenses, 5000); // Poll every 5 seconds for updates
        }
    });

    function login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            alert('Please fill in email and password');
            return;
        }

        fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                window.location.href = data.redirect;
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function signup() {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        if (!name || !email || !password) {
            alert('Please fill in name, email, and password');
            return;
        }

        fetch('/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                window.location.href = data.redirect;
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function addExpense() {
        const amount = document.getElementById('amount').value;
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value;

        if (!amount || !date) {
            alert('Please fill in amount and date');
            return;
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            alert('Please enter a valid date in YYYY-MM-DD format');
            return;
        }

        fetch('/add_expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, category, date, description })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                document.getElementById('amount').value = '';
                document.getElementById('description').value = '';
                fetchExpenses();
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function addExpenseToTable(expense) {
        const tbody = document.getElementById('expenseList');
        const row = document.createElement('tr');
        row.id = `expense-${expense.id}`;
        row.innerHTML = `
            <td class="p-2">${expense.date}</td>
            <td class="p-2">${expense.amount}</td>
            <td class="p-2">${expense.category}</td>
            <td class="p-2">${expense.description}</td>
            <td class="p-2">
                <button class="edit-btn" onclick="openEditModal(${expense.id}, ${expense.amount}, '${expense.category}', '${expense.date}', '${expense.description}')">Edit</button>
                <button class="delete-btn" onclick="deleteExpense(${expense.id})">Delete</button>
            </td>
        `;
        tbody.prepend(row);
    }

    function openEditModal(id, amount, category, date, description) {
        document.getElementById('editId').value = id;
        document.getElementById('editAmount').value = amount;
        document.getElementById('editCategory').value = category;
        document.getElementById('editDate').value = date;
        document.getElementById('editDescription').value = description || '';
        document.getElementById('editModal').classList.remove('hidden');
    }

    function closeEditModal() {
        document.getElementById('editModal').classList.add('hidden');
        document.getElementById('editId').value = '';
        document.getElementById('editAmount').value = '';
        document.getElementById('editCategory').value = 'Food';
        document.getElementById('editDate').value = '';
        document.getElementById('editDescription').value = '';
    }

    function updateExpense() {
        const id = document.getElementById('editId').value;
        const amount = document.getElementById('editAmount').value;
        const category = document.getElementById('editCategory').value;
        const date = document.getElementById('editDate').value;
        const description = document.getElementById('editDescription').value;

        if (!amount || !date) {
            alert('Please fill in amount and date');
            return;
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            alert('Please enter a valid date in YYYY-MM-DD format');
            return;
        }

        fetch(`/update_expense/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, category, date, description })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                closeEditModal();
                fetchExpenses();
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function deleteExpense(id) {
        fetch(`/delete_expense/${id}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    fetchExpenses();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => console.error('Error:', error));
    }

    function fetchExpenses() {
        const periodSelect = document.getElementById('period');
        if (!periodSelect) {
            console.error('Period select element not found');
            return;
        }
        const period = periodSelect.value;
        fetch(`/get_expenses?period=${period}`)
            .then(response => response.json())
            .then(expenses => {
                document.getElementById('expenseList').innerHTML = '';
                expenses.forEach(addExpenseToTable);
                updateCharts(expenses, period);
            })
            .catch(error => console.error('Error:', error));
    }

    function updateCharts(expenses, period) {
        const categories = ['Food', 'Transport', 'Entertainment', 'Bills', 'Others'];
        const categorySums = categories.map(cat => 
            expenses.filter(e => e.category === cat).reduce((sum, e) => sum + parseFloat(e.amount), 0)
        );

        // Pie Chart
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(document.getElementById('pieChart'), {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{
                    data: categorySums,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                }]
            },
            options: { responsive: true }
        });

        // Bar Chart
        const { labels, dateRange } = getBarChartLabels(period, expenses);
        const data = labels.map((label, index) => {
            if (period === 'yearly') {
                return expenses.filter(e => new Date(e.date).getMonth() === index)
                    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
            } else if (period === 'lifetime') {
                return expenses.filter(e => {
                    const expenseYear = new Date(e.date).getFullYear();
                    return expenseYear.toString() === label;
                }).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            }
            return expenses.filter(e => {
                const expenseDate = new Date(e.date);
                if (period === 'daily') {
                    return e.date === label;
                } else if (period === 'weekly' || period === 'monthly') {
                    const [start, end] = dateRange[index] || [];
                    return start && end && expenseDate >= new Date(start) && expenseDate <= new Date(end);
                }
                return false;
            }).reduce((sum, e) => sum + parseFloat(e.amount), 0);
        });

        if (barChart) barChart.destroy();
        barChart = new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expenses',
                    data: data,
                    backgroundColor: '#36A2EB'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function getBarChartLabels(period, expenses) {
        const today = new Date();
        let labels = [];
        let dateRange = [];

        if (period === 'daily') {
            const latestDate = expenses.length > 0 
                ? expenses.reduce((latest, e) => new Date(e.date) > new Date(latest) ? e.date : latest, expenses[0].date)
                : today.toISOString().split('T')[0];
            labels = [latestDate];
            dateRange = [[latestDate, latestDate]];
        } else if (period === 'weekly') {
            const latestDate = expenses.length > 0 
                ? new Date(expenses.reduce((latest, e) => new Date(e.date) > new Date(latest) ? e.date : latest, expenses[0].date))
                : today;
            labels = Array.from({length: 7}, (_, i) => {
                const d = new Date(latestDate);
                d.setDate(latestDate.getDate() - i);
                return d.toISOString().split('T')[0];
            }).reverse();
            dateRange = labels.map(date => [date, date]);
        } else if (period === 'monthly') {
            const latestDate = expenses.length > 0 
                ? new Date(expenses.reduce((latest, e) => new Date(e.date) > new Date(latest) ? e.date : latest, expenses[0].date))
                : today;
            labels = Array.from({length: 30}, (_, i) => {
                const d = new Date(latestDate);
                d.setDate(latestDate.getDate() - i);
                return d.toISOString().split('T')[0];
            }).reverse();
            dateRange = labels.map(date => [date, date]);
        } else if (period === 'yearly') {
            labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const year = expenses.length > 0 
                ? new Date(expenses.reduce((latest, e) => new Date(e.date) > new Date(latest) ? e.date : latest, expenses[0].date)).getFullYear()
                : today.getFullYear();
            dateRange = labels.map((_, i) => {
                const start = new Date(year, i, 1);
                const end = new Date(year, i + 1, 0);
                return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
            });
        } else if (period === 'lifetime') {
            if (expenses.length === 0) {
                labels = [today.getFullYear().toString()];
                dateRange = [[today.toISOString().split('T')[0], today.toISOString().split('T')[0]]];
            } else {
                const years = [...new Set(expenses.map(e => new Date(e.date).getFullYear()))].sort();
                labels = years.map(year => year.toString());
                dateRange = years.map(year => {
                    const start = new Date(year, 0, 1);
                    const end = new Date(year, 11, 31);
                    return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
                });
            }
        }

        return { labels, dateRange };
    }
} else {
    console.error('This script is designed to run in a browser, not in Node.js');
}