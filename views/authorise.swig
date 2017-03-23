{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>{{translation.requestingAccess}}</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="Aligner">
  <div class="Aligner-item">
    <img src="http://www.fuelrats.com/wp-content/uploads/2015/07/ratsticker-1024x1024.jpg" alt="FuelRats Logo" class="logo">
    <form action="/oauth2/authorize" method="post">
      <div class="page-header" style="text-align: center;">
        <h1>{{translation.authoriseTitle}}</h1>
      </div>
      <h5>{% autoescape false %}{{translation.requestingAccess}}{% endautoescape %}</h5>

      <div class="col-md-6 col-md-offset-3" style="margin-top: 25px;">

          {{translation.requestingAccessTo}}<br/>

        <ul style="margin-top: 5px;">
        {% for scope in translation.scopes %}
          {% if scope.accessible %}
            <li>{{scope.permission}}</li>
          {% else %}
            <li class="inaccessible">{{scope.permission}}</li>
          {% endif %}
        {% endfor %}
        </ul>

      </div>

      <input name="transaction_id" type="hidden" value="{{transactionId}}">
      <input name="scope" type="hidden" value="{{scope}}">
      <div class="col-md-6 col-md-offset-4" style="margin-top: 15px;">
        <button type="submit" value="allow" class="btn btn-success">{{translation.authoriseAllow}}</button>
        <button type="submit" value="deny" class="btn btn-danger">{{translation.authoriseDeny}}</button>
      </div>
    </form>
  </div>
</div>

{% endblock %}
