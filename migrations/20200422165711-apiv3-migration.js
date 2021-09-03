/* eslint-disable no-console,max-statements,no-magic-numbers */
'use strict'

module.exports = {
  up: async (migration, db) => {
    const type = db.DataTypes

    await migration.sequelize.transaction(async (transaction) => {
      /*
      **************************************
      * OAUTH CLIENT MIGRATIONS
      **************************************
      *  */
      console.log('### Performing OAuth Client Migrations..')

      console.log('- Adding namespaces and first party fields to OAuth Clients')
      const namespaceFieldMaxLength = 128
      await migration.addColumn('Clients', 'namespaces', {
        type: type.ARRAY(type.STRING(namespaceFieldMaxLength)),
        defaultValue: [],
      }, { transaction })

      await migration.addColumn('Clients', 'firstParty', {
        type: type.BOOLEAN,
        defaultValue: false,
      }, { transaction })

      /*
      **************************************
      * EPICS MIGRATIONS
      **************************************
      *  */
      console.log('### Performing Epics Migrations..')

      console.log('- Adding "Approved by user" field to Epics')
      await migration.addColumn('Epics', 'approvedById', {
        type: type.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      }, { transaction })

      console.log('- Adding "Nominated by user" field to Epics')
      await migration.addColumn('Epics', 'nominatedById', {
        type: type.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      }, { transaction })

      console.log('- Removing old single nominated rat field from Epic')
      await migration.removeColumn('Epics', 'ratId', { transaction })

      console.log('- Adding soft delete column to Epics')
      await migration.addColumn('Epics', 'deletedAt', {
        type: type.DATE,
        allowNull: true,
      }, { transaction })

      console.log('- Creating a join table for the users nominated for an epic')
      await migration.createTable('EpicUsers', {
        id: {
          type: type.UUID,
          primaryKey: true,
        },
        epicId: {
          type: type.UUID,
          references: {
            model: 'Epics',
            key: 'id',
          },
        },
        userId: {
          type: type.UUID,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
        createdAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
        updatedAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
      }, { transaction })

      /*
      **************************************
      * USER GROUPS MIGRATIONS
      **************************************
      *  */
      console.log('### Performing User Groups Migrations..')

      console.log('- Renaming the isAdministrator field to withoutPrefix')
      await migration.renameColumn('Groups', 'isAdministrator', 'withoutPrefix', { transaction })


      console.log('- Adding field for storing IRC channel permissions')
      await migration.addColumn('Groups', 'channels', {
        type: type.JSONB,
        defaultValue: {},
      }, { transaction })

      console.log('- Changing User Groups userId field to lower case')
      await migration.renameColumn('UserGroups', 'UserId', 'userId', { transaction })

      console.log('- Adding field for storing custom user permission API rate limits')
      await migration.addColumn('Groups', 'rateLimit', {
        type: type.INTEGER,
        allowNull: true,
      }, { transaction })

      console.log('- Transitioning the Groups table from string primary keys based on the name to UUIDs')
      console.log('- Creating the new ID field and populating it with random UUIDs')
      await migration.addColumn('Groups', 'id2', {
        type: type.UUID,
        defaultValue: db.literal('uuid_generate_v4()'),
      }, { transaction })

      console.log('- Creating new User Groups group id field for UUIDs')
      await migration.addColumn('UserGroups', 'groupId', {
        type: type.UUID,
      }, { transaction })

      console.log('- Remapping the User Groups join table to use the new UUIDs')
      await migration.sequelize.query(`
        UPDATE "UserGroups"
        SET "groupId" = "Groups"."id2"
        FROM "Groups"
        WHERE
            "Groups"."id" = "UserGroups"."GroupId"
      `, { transaction })

      console.log('- Removing the old string Group Id column')
      await migration.removeColumn('UserGroups', 'GroupId', { transaction })

      console.log('- Removing Primary Key constraint on old group ID and make it the "name" field')
      await migration.removeConstraint('Groups', 'Groups_pkey', { transaction })
      await migration.renameColumn('Groups', 'id', 'name', { transaction })

      console.log('- Changing the name of the new UUID field to "id" and make it the primary key')
      await migration.renameColumn('Groups', 'id2', 'id', { transaction })

      await migration.addConstraint('Groups', ['id'], {
        type: 'primary key',
        transaction,
      })

      console.log('- Adding back foreign key reference from the UserGroups join table to the new UUID Groups')
      await migration.changeColumn('UserGroups', 'groupId', {
        type: type.UUID,
        references: {
          model: 'Groups',
          key: 'id',
        },
      }, { transaction })

      console.log('- Marking existing users as verified')
      const verified = await migration.findOne({
        where: {
          name: 'default',
        },
        transaction,
      })

      // The old 'default' permission group is now called 'verified' as it only applies to users with a verified email, users without has no permissions.
      verified.name = 'verified'
      await verified.save({ transaction })

      await migration.sequelize.query(`
          INSERT INTO "UserGroups" (id, "userId", "groupId", "createdAt", "updatedAt")
          SELECT uuid_generate_v4(),
                 "Users"."id",
                 $groupId,
                 NOW(),
                 NOW()
          FROM "Users"
                   LEFT JOIN "UserGroups" ON "UserGroups"."userId" = "Users"."id"
                   LEFT JOIN "Rats" ON "Rats"."userId" = "Users"."id" AND "Rats"."deletedAt" IS NULL
                   LEFT JOIN "RescueRats" ON "RescueRats"."ratId" = "Rats"."id"
          WHERE "Users"."deletedAt" IS NULL
          GROUP BY "Users"."id"
          HAVING COUNT("UserGroups"."id") > 0
              OR COUNT("RescueRats"."id") > 0
      `, {
        bind: { groupId: verified.id },
        transaction,
      })

      /*
      **************************************
      * RESCUES MIGRATIONS
      **************************************
      *  */
      console.log('###  Performing Rescues Migrations..')

      console.log('- Adding new fields to the Rescues table for Mecha related info')
      await migration.addColumn('Rescues', 'commandIdentifier', {
        type: type.INTEGER,
        allowNull: true,
      }, { transaction })

      await migration.addColumn('Rescues', 'clientNick', {
        type: type.STRING,
        allowNull: true,
      }, { transaction })

      await migration.addColumn('Rescues', 'clientLanguage', {
        type: type.STRING,
        allowNull: true,
      }, { transaction })


      console.log('- Migrating mecha data from the JSON data field to the newly created fields')
      await migration.sequelize.query(`
        UPDATE "Rescues"
          SET
              "commandIdentifier" = CAST ("data"->>'boardIndex' AS INTEGER),
              "clientNick" = COALESCE("data"->>'IRCNick', "client"),
              "clientLanguage" = "data"->>'langID'
      `, { transaction })

      console.log('- Adding new fields to Rescues table for revision tracking of rescues')
      await migration.addColumn('Rescues', 'lastEditUserId', {
        type: type.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      }, { transaction })

      console.log('- Adding last edited by oauth client field for revision tracking of rescues')
      await migration.addColumn('Rescues', 'lastEditClientId', {
        type: type.UUID,
        allowNull: true,
        references: {
          model: 'Clients',
          key: 'id',
        },
      }, { transaction })

      console.log('- Adding entry validity period field for revision tracking of rescues')
      await migration.addColumn('Rescues', 'temporalPeriod', {
        type: type.RANGE(type.DATE),
        defaultValue: [type.now, undefined],
      }, { transaction })

      console.log('- Fixing the temporal period field so it begins when the rescue entry was created')
      await migration.sequelize.query(`
        UPDATE "Rescues"
        SET
          "temporalPeriod" = tstzrange("createdAt", NULL)
      `, { transaction })


      console.log('- Fixing capitalisation of join table foreign key fields')
      await migration.renameColumn('RescueRats', 'RescueId', 'rescueId', { transaction })
      await migration.renameColumn('RescueRats', 'RatId', 'ratId', { transaction })

      console.log('- Adding last edited by user field for revision tracking of rescue assigned rats')
      await migration.addColumn('RescueRats', 'assignerUserId', {
        type: type.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      }, { transaction })

      console.log('- Adding last edited by client id for revision tracking of rescue assigned rats')
      await migration.addColumn('RescueRats', 'assignerClientId', {
        type: type.UUID,
        allowNull: true,
        references: {
          model: 'Clients',
          key: 'id',
        },
      }, { transaction })

      console.log('- Adding entry validity period field for revision tracking of rescue assigned rats')
      await migration.addColumn('RescueRats', 'temporalPeriod', {
        type: type.RANGE(type.DATE),
        defaultValue: [type.now, undefined],
      }, { transaction })

      console.log('- Fixing the temporal period field so it begins when the rescue rats entry was created')
      await migration.sequelize.query(`
        UPDATE "RescueRats"
        SET
          "temporalPeriod" = tstzrange("createdAt", NULL)
      `, { transaction })

      /*
      **************************************
      * RESET MIGRATION
      **************************************
      *  */
      console.log('###  Performing Resets Migrations..')

      console.log('- Adding field for requiring a password reset on login')
      await migration.addColumn('Resets', 'required', {
        type: type.BOOLEAN,
      }, { transaction })

      /*
      **************************************
      * VERIFICATION TOKEN MIGRAITON
      **************************************
      *  */
      console.log('###  Performing VerificationToken Migrations..')

      console.log('- Adding VerificationTokens table')
      await migration.createTable('VerificationTokens', {
        id: {
          type: type.UUID,
          primaryKey: true,
        },
        value: {
          type: type.STRING,
        },
        expires: {
          type: type.DATE,
        },
        userId: {
          type: type.UUID,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
        createdAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
        updatedAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
      }, { transaction })

      /*
      **************************************
      * SESSION MIGRATION
      **************************************
      *  */
      console.log('###  Performing Session Migrations..')

      console.log('- Adding Sessions table')
      await migration.createTable('Sessions', {
        id: {
          type: type.UUID,
          primaryKey: true,
        },
        ip: {
          type: type.INET,
        },
        userAgent: {
          type: type.STRING,
        },
        lastAccess: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
        verified: {
          type: type.BOOLEAN,
          defaultValue: false,
        },
        code: {
          type: type.STRING(6),
        },
        userId: {
          type: type.UUID,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
        createdAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
        updatedAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
      }, { transaction })

      /*
      **************************************
      * USER MIGRATIONS
      **************************************
      *  */
      console.log('###  Performing User Migrations..')

      console.log('- Transitioning Avatars to a separate table')
      await migration.createTable('Avatars', {
        id: {
          type: type.UUID,
          primaryKey: true,
        },
        image: {
          type: type.BLOB(),
        },
        createdAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
        updatedAt: {
          type: type.DATE,
          defaultValue: type.NOW,
        },
        userId: {
          type: type.UUID,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
      }, { transaction })
      await migration.removeColumn('Users', 'image', { transaction })

      console.log('- Setting Rats createdAt value to their joined value for old rats')
      await migration.sequelize.query(`
        UPDATE "Rats"
        SET
          "createdAt" = "joined"
        WHERE
          "createdAt" > "joined"
      `, { transaction })

      console.log('- Retroactively setting the user createdAt value to the rat joined date for old rats')
      await migration.sequelize.query(`
          UPDATE "Users"
          SET "createdAt" = "Rats"."joined"
          FROM "Rats"
          WHERE "Rats"."deletedAt" IS NULL
            AND "Rats"."userId" = "Users"."id"
            AND "Rats"."joined" < "Users"."createdAt"
      `)

      console.log('- Removing the deprecated Rats joined field')
      await migration.removeColumn('Rats', 'joined', { transaction })

      console.log('- Adding Frontier ID fields')
      await migration.addColumn('Rats', 'frontierId', {
        type: type.INTEGER,
        allowNull: true,
        unique: true,
      }, { transaction })

      await migration.addColumn('Users', 'frontierId', {
        type: type.INTEGER,
        allowNull: true,
        unique: true,
      }, { transaction })

      console.log('- Removing the old still unused dispatch field')
      await migration.removeColumn('Users', 'dispatch', { transaction })

      console.log('- Removing old IRC nicknames field')
      await migration.removeColumn('Users', 'nicknames', { transaction })

      console.log('- Adding new user status field')
      await migration.addColumn('Users', 'status', {
        type: type.ENUM('active', 'inactive', 'legacy', 'deactivated'),
        defaultValue: 'active',
      }, { transaction })

      console.log('- Adding new suspended user field')
      await migration.addColumn('Users', 'suspended', {
        type: type.DATE,
        allowNull: true,
        defaultValue: undefined,
      }, { transaction })

      console.log('Committing Transaction..')
    })


    console.log('- Adding new "purge" outcome to Rescues to use as MD (marked for deletion) status')
    /*
    * You cannot edit enum values within transactions because of reasons, so we are executing this one
    * after all the other changes in the transaction have been made.
    * */
    await migration.sequelize.query(`
        ALTER TYPE "enum_Rescues_outcome" ADD VALUE 'purge'
    `)

    await migration.sequelize.transaction(async (transaction) => {
      console.log('- Transitioning marked for deletion items to the new outcome')
      await migration.sequelize.query(`
        UPDATE "Rescues"
        SET
            "outcome" = 'purge',
            "notes" = "data"->'markedForDeletion'->>'reason'
        WHERE
            CAST("data"->'markedForDeletion'->>'marked' AS BOOLEAN) = TRUE
      `, { transaction })

      console.log('Committing Transaction..')
    })
    console.log(`

    --- MIGRATION COMPLETE ---
    `)
  },

  down: () => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
  },
}
