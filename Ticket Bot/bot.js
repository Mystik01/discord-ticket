require('dotenv').config();
const { Client, CategoryChannel, MessageEmbed, Discord } = require('discord.js')
const client = new Client({ partials: ['MESSAGE', 'REACTION']});
const db = require ('./database');
const Ticket = require('./models/Ticket');
const TicketConfig = require('./models/TicketConfig');
const sleep = require ('sleep.js');
const owner = '<YOUR_DISCORD_ID>';

client.once('ready', () => {
    console.log('Bot is online and connected');
    db.authenticate()
        .then(() => {
            console.log('Connected to Database');
            Ticket.init(db);
            TicketConfig.init(db);
            Ticket.sync();
            TicketConfig.sync();
        }).catch((err) => console.log(err));
});

client.on('message', async (message, channel) => {

    if (message.content.toLowerCase() === '?help') {
        message.delete({ timeout: 1000})
        const helpEmbed = new MessageEmbed() //this is an embed
        .setTitle('**Ticket Bot - Help**__') //set the tittle
        .setDescription('**Admin commands:**\n?setup - Sets up how the tickets work and how they are configured.\n?help - This command that you are currently viewing.\n\n\n*If you want to change the preifx or add new commands, please contact Mystik#0599 to do so or click [here](https://discord.com/users/590172271415525377).*') //the main description, use /n to make a new line
        .setColor('#f1db30') //set the colour of the embed in hex (currently yellow)
        .setFooter('SOME FOOTER') // add a footer
        .setAuthor('SOME AUTHOR', 'https://some_profile_pic.com/picture.png') // add a profile picture, same can be added for an author too

        message.channel.type === (`"dm"`) + message.author.send(helpEmbed);
    }

    if (message.content.toLowerCase() === '?ticketmsg') {
        const TicketEmbed = new MessageEmbed()
        .setTitle('**To create a ticket, react with 📩**')

        message.channel.send(TicketEmbed);
        message.channel.send('Now copy the message ID of the embed above, and delete this message. Use the ID when you use ``?setup``.')
    }

    if (message.author.bot || message.channel.type === 'dm') return;
    
    if (message.content.toLowerCase() === '?setup' && message.guild.ownerID === message.author.id){
        try {
            const filter = (m) => m.author.id === message.author.id;
            message.channel.send('Please enter the message ID for this ticket');
            const msgID  = (await message.channel.awaitMessages(filter, { max: 1 })).first().content;
            const fetchMsg = await message.channel.messages.fetch(msgID);
            message.channel.send('Please enter the category ID where all the tickets will be shown and created');
            const categoryID = (await message.channel.awaitMessages(filter, { max: 1})).first().content;
            const categoryChannel = client.channels.cache.get(categoryID); 
            message.channel.send('Please enter all the roles which would access all the tickets');
            const roles =  (await message.channel.awaitMessages(filter, { max: 1})).first().content.split(/,\s*/);
            console.log(roles)
            if (fetchMsg & categoryChannel) {
                for (const roleId of roles) 
                    if (!message.guild.roles.cache.get(roleId)) throw new Error('Role does not exist'),
                    message.channel.send('The role that you have entered does not exist!, please restart the setup'),
                    console.log(err);

                    const ticketConfig = await TicketConfig.create({
                        messageId: msgID,
                        guildId: message.guild.id,
                        roles: JSON.stringify(roles),
                        parentId: categoryChannel.id
                    });
                message.channel.send('Saved config to Database! You can delete the past setup messages, just leave the reaction'),
                await fetchMsg.react('📩');
                } else throw new Error('Invalid fields');

             } catch (err) {
            console.log(err);
            
            message.channel.send("Invalid answer, please type the correct ID's!")

        }
    }
});

client.on('messageReactionAdd', async (reaction, user, channel, message) => {
    if (user.bot) return;
    if (reaction.emoji.name === '📩') {
        const ticketConfig = await TicketConfig.findOne({ where: { messageId: reaction.message.id }});
        if (ticketConfig) {
            const findTicket = await Ticket.findOne({ where: { authorId: user.id, resolved: false}});
            if (findTicket) user.send('Your already have a ticket open!');
            else {
                console.log('Creating ticket');
                try {
                    const roleIdsString = ticketConfig.getDataValue('roles');
                    console.log(roleIdsString);
                    const roleIds = JSON.parse(roleIdsString);
                    const permissions = roleIds.map((id) => ({ allow: 'VIEW_CHANNEL', id}));
                    const channel = await reaction.message.guild.channels.create('ticket', {
                        parent: ticketConfig.getDataValue('parentId'),
                        permissionOverwrites: [
                            { deny: 'VIEW_CHANNEL', id: reaction.message.guild.id },
                            { allow: 'VIEW_CHANNEL', id: user.id },
                            ...permissions
                        ]
                    });
                    const CategoryEmbed = new MessageEmbed() //this is an embed 
                    .setTitle('**Please categorize your issue with one of the options below:**')
                    .setDescription('1️⃣ **Report a player** - Report a player for griefing.\n\n2️⃣ **Tournament Help** - If you need help signing up to a tournament or have any questions, select this.\n\n3️⃣ **Speak to a moderator** - If you need to speak to our staff about another issue which is not listed here, select this.') //you can customize this message
                    .setFooter('some footer')
                    .setAuthor('soe author', 'https://some_profile_pic.com/picture.png')
                    .setColor('#f1db30')
                    const msg = await channel.send('Please explain a brief description about your query below, our staff will get back to you as soon as possible. \nReact below to close this ticket.');
                    await msg.react('🔒'); //when a user reacts to this it will close this ticket
                    msg.pin();
                    const CategoryMSG = await channel.send('__**Please categorize your issue with one of the options below:**__\n1️⃣ **Report a player** - Report a player for griefing.\n\n2️⃣ **Tournament Help** - If you need help signing up to a tournament or have any questions, select this.\n\n3️⃣ **Speak to a moderator** - If you need to speak to our staff about another issue which is not listed here, select this.') //you can customize this too
                    await CategoryMSG.react('1️⃣'),
                    await CategoryMSG.react('2️⃣'),
                    await CategoryMSG.react('3️⃣');
                    

                    const ticket = await Ticket.create({
                        authorId: user.id,
                        channelId: channel.id,
                        guildId: reaction.message.guild.id,
                        resolved: false,
                        closedMessageId: msg.id
                    });

                    const ticketId = String(ticket.getDataValue('ticketId')).padStart(4, 0);
                    await channel.edit({ name: `ticket-${ticketId}`})


                } catch (err) {
                    console.log(err);
                    client.users.cache.get(owner).send(err);
                }
            }
        } else {
            console.log('No ticket config found!');
        }
   }  else if (reaction.emoji.name === '🔒') { 
        const ticket = await Ticket.findOne({ where: { channelId: reaction.message.channel.id }}) //this part closes the ticket / hides it from the user so only admins can see
        if (ticket) {
            console.log('Ticket has been found');
            const closedMessageId = ticket.getDataValue('closedMessageId');
            if (reaction.message.id === closedMessageId) {
                reaction.message.channel.updateOverwrite(ticket.getDataValue('authorId'), {
                    VIEW_CHANNEL: false 
                }).catch((err) => console.log(err));
                ticket.resolved = true;
                await ticket.save();
                console.log('Updated');
            }

        }
    }; if (reaction.emoji.name === '1️⃣') { //this is random stuff so ignore it, it doesnt work
        await message.channel.send('You have selected **Report a Player**, our staff have been notified and will be here to assist you shortly.');
        } if (reaction.emoji.name === '2️⃣') {
                await message.channel.send('You have selected **Tournament Help**, our staff have been notified and will assist you shortly.');
                } if (reaction.emoji.name === '3️⃣') {
                   await message.channel.send('You have selected **Speak to a Moderator**, our staff have been notified and will assist you shortly.');
                }

});

client.login(process.env.BOT_TOKEN);
