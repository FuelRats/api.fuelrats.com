<template id="removeShipDialogTemplate">
<div class="modal fade" id="removeShipDialog" tabindex="-1" role="dialog" aria-labelledby="Remove Ship">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title" id="myModalLabel">Delete Ship</h4>
        </div>
        <div class="modal-body">
          <div class="alert alert-danger" role="alert">
            <b>Are you sure you want to delete this ship?</b><br>
            <p>You will need an administrator in order to add it back with the same registration</p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="modalRemoveShipButton">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>
