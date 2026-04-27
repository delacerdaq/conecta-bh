function calculateProfit() {
    const investment = parseFloat(document.getElementById('investment').value) || 0;
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const expenses = parseFloat(document.getElementById('expenses').value) || 0;
    const months = parseInt(document.getElementById('months').value) || 12;

    if (investment <= 0 || revenue <= 0) {
        alert('Por favor, preencha todos os campos com valores válidos');
        return;
    }

    const monthlyProfit = revenue - expenses;
    const totalProfit = monthlyProfit * months - investment;
    const roi = (totalProfit / investment) * 100;
    const payback = investment / monthlyProfit;

    document.getElementById('monthly-profit').textContent = `R$ ${monthlyProfit.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-profit').textContent = `R$ ${totalProfit.toFixed(2).replace('.', ',')}`;
    document.getElementById('roi').textContent = `${roi.toFixed(2).replace('.', ',')}%`;
    document.getElementById('payback').textContent = `${payback.toFixed(1).replace('.', ',')} meses`;

    document.getElementById('results').style.display = 'block';
}
