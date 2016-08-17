{% extends '../layouts/main.swig' %}

{% block head %}
{% parent %}
<title>404 - Page Not Found</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="Aligner">
  <div class="Aligner-item">
    <img src="https://www.fuelrats.com/wp-content/uploads/2016/06/mechsqueak404_1400.jpg" alt="Fuel Rats Error Art by Uvelius Sang" class="errorart">
    <div class="page-header" style="text-align: center;">
      <h1>404 Not Found</h1>
    </div>
    <h5><b>The page {{ path }} cannot be found</b></h5>
    <div class="col-md-6 col-md-offset-5" style="margin-top: 15px;">
      <button onclick="history.go(-1)" value="deny" class="btn btn-danger">Go back</button>
    </div>
  </div>
</div>

{% endblock %}
