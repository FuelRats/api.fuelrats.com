

{% extends '../layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Change Pasword</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="Aligner">
  <div class="Aligner-item">
    <img src="http://www.fuelrats.com/wp-content/uploads/2015/07/ratsticker-1024x1024.jpg" alt="FuelRats Logo" class="logo">
    <div class="page-header" style="text-align: center;">
      <h1>403 Forbidden</h1>
    </div>
    <h5><b>You do not have the required permissions to perform this action</b></h5>

    {% if message %}
    <p style="text-align: center">{{ message }}</p>
    {% endif %}

    <input name="transaction_id" type="hidden" value="{{transactionId}}">
    <div class="col-md-6 col-md-offset-5" style="margin-top: 15px;">
      <button onclick="history.go(-1)" value="deny" class="btn btn-danger">Go back</button>
    </div>
  </div>
</div>

{% endblock %}
