<template id="removeNicknameDialogTemplate">
<div class="modal fade" id="removeNicknameDialog" tabindex="-1" role="dialog" aria-labelledby="Remove Nickname">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title" id="myModalLabel">Delete IRC Nickname</h4>
        </div>
        <div class="modal-body">
          <div class="alert alert-danger" role="alert">
            <b>Are you sure you want to delete this nickname?</b><br>
            <p>The nickname will be unregistered on the IRC server and you will permanently lose all channel permissions on this nickname</p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="modalRemoveNicknameButton">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>
