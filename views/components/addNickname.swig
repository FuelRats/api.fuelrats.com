<template id="addNicknameDialogTemplate">
  <div class="modal fade" id="addNicknameDialog" tabindex="-1" role="dialog" aria-labelledby="Add Nickname">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title" id="myModalLabel">Add IRC Nickname</h4>
        </div>
        <div class="modal-body">

        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="modalAddNicknameButton">Add</button>
        </div>
      </div>
    </div>
  </div>
</template>

<template id="addNicknameCheckTemplate">
  <label for="modalAddNicknameField">Nickname</label>
  <input type="text" class="form-control" placeholder="Nickname" aria-describedby="IRC Nickname" id="modalAddNicknameField">
</template>

<template id="addNicknameAuthTemplate">
    <div class="alert alert-info" role="alert">This IRC nickname is already registered, please enter the password of this nickname to proceed</div>
    <label for="connectNicknamePasswordField">Password</label>
    <input type="password" class="form-control" id="connectNicknamePasswordField" placeholder="Password">
</template>

<template id="addNicknameAuthTemplate">
    <div class="alert alert-success" role="alert">This IRC nickname is available</div>
    <label for="connectNicknamePasswordField">Password</label>
    <input type="password" class="form-control" id="connectNicknamePasswordField" placeholder="Password">
</template>
