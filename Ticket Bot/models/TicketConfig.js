const { DataTypes, Model } = require('sequelize')

module.exports = class TicketConfig extends Model {
    static init(sequelize) {
        return super.init({
            messageId: {
                type: DataTypes.STRING,
                primaryKey: true
            },
            guildId: {
                type: DataTypes.STRING
            },
            roles: {
                type: DataTypes.STRING
            },
            parentID: {
                type: DataTypes.STRING
            }
        }, {
            tableName: 'TicketConfigs',
            sequelize
        })
    }
}