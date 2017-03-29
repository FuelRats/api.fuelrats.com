{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Fuel rats Paperwork</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="container-fluid">
  <h1>Paperwork</h1>
  <form id="paperwork" action="/rescues" method="post">
    <div class="form-group">
      <h3 style="color: #ff0000">YOU ONLY USE THIS FORM IF MECHA HAS NOT ALREADY CREATED A CASE.<br> OTHERWISE USE THE LINK THAT WAS POSTED TO YOU IN PRIVATE MESSAGE</h3>

    </div>

    <div class="alert alert-danger" role="alert">
      Can't find your rat name? <a target="_blank" href="http://1drv.ms/1TNcpVw" class="alert-link">Report a problem</a>
    </div>

    <div class="form-group">
      <label for="rats">Who arrived for the rescue?</label>
      <input type="text" name="rats" id="rats" class="form-control" value="{{ rat.CMDRname }}" required>
    </div>

    <div class="form-group">
      <label for="firstLimpet">Who fired the first limpet?</label>
      <input type="text" name="firstLimpet" id="firstLimpet" class="form-control" data-autocomplete="CMDRname" value="{{ rat.CMDRname }}">
    </div>

    <div class="form-group">
      <label for="successful">What platform was it on?</label>
      <br>
      <div class="radio-inline">
        <label>
          <input type="radio" name="platform" value="pc" checked>
          PC
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" name="platform" value="xb">
          Xbox One
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" name="platform" value="ps">
          PlayStation 4
        </label>
      </div>
    </div>

    <div class="form-group">
      <label for="system">Where did it happen?</label>
      <small>In what star system did the rescue took place? (put "n/a" if not applicable)</small>
      <input type="text" name="system" id="system" class="form-control" required autofocus>
    </div>

    <div class="form-group">
      <label for="successful">Was the rescue successful?</label>
      <br>
      <div class="radio-inline">
        <label>
          <input type="radio" name="successful" value="true" checked>
          Yes
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" name="successful" value="false">
          No
        </label>
      </div>
    </div>

    <div class="form-group">
      <label for="codeRed">Was it a code red?</label>
      <br>
      <div class="radio-inline">
        <label>
          <input type="radio" name="codeRed" value="true">
          Yes
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" name="codeRed" value="false" checked>
          No
        </label>
      </div>
    </div>

    <div class="form-group">
      <label for="notes">Notes</label>
      <textarea name="notes" id="notes" class="form-control"></textarea>
    </div>

    <input type="hidden" name="open" value="false">

    <button type="submit" class="btn btn-primary">Submit</button>
  </form>
</div>
{% endblock %}

{% block resources %}
{% parent %}
<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/jquery.bootstrapvalidator/0.5.1/css/bootstrapValidator.min.css">
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery.bootstrapvalidator/0.5.1/js/bootstrapValidator.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/typeahead.js/0.11.1/typeahead.bundle.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/backbone.js/1.2.3/backbone-min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/backbone.marionette/2.4.4/backbone.marionette.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/backbone.stickit/0.8.0/backbone.stickit.min.js"></script>
<script src="/bootstrap-tagsinput.js"></script>
<script src="paperwork.js"></script>
{% endblock %}
