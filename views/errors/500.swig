{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>500 Internal Server Error</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="Aligner">
  <div class="Aligner-item">
    <div class="page-header" style="text-align: center;">
      <h1>500 Internal Server Error</h1>
    </div>
    <img src="https://www.fuelrats.com/wp-content/uploads/2016/08/mechsqueak500-1024x952.jpg" alt="FuelRats Error Image">


    <div class="col-md-6 col-md-offset-5" style="margin-top: 15px;">
      <button onclick="history.go(-1)" value="deny" class="btn btn-danger">Go back</button>
    </div>
  </div>
</div>

{% endblock %}
