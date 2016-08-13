{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>503 - Service Unavailable</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="Aligner">
  <div class="Aligner-item">
    <img src="http://www.fuelrats.com/wp-content/uploads/2015/07/ratsticker-1024x1024.jpg" alt="FuelRats Logo" class="logo">
    <div class="page-header" style="text-align: center;">
      <h1>503 - Service Unavailable</h1>
    </div>
    <h5><b>The website is currently under maintenance</b></h5>

    <div class="col-md-6 col-md-offset-5" style="margin-top: 15px;">
      <button onclick="history.go(-1)" value="deny" class="btn btn-danger">Go back</button>
    </div>
  </div>
</div>

{% endblock %}
