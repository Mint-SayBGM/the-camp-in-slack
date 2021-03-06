import { Message, Modal, Blocks, Elements, Bits } from 'slack-block-builder';
import { SOLDIER } from './data';
import { chunkString, parseData } from './utils';
import { SlackParams } from './model';
import { callAPIMethod, getNickName, getSoldierData, sendMessage } from './api';
import { camelizeKeys } from 'humps';
import { Soldier } from 'the-camp-lib';


module.exports.openModal = async (event, context) => {
  const params = parseData<SlackParams>(event.body);

  const messageData = {
    view: Modal({ title: '훈련소로 편지보내기', submit: '편지 보내기' })
    .blocks(
      Blocks.Input({ label: '훈련병 선택', blockId: 'id' })
        .element(
          Elements.StaticSelect()
            .initialOption(
              Bits.Option({ text: '모두에게', value: 'all' })
            )
            .options([
              Bits.Option({ text: '모두에게', value: 'all' }),
              ...SOLDIER.map((soldier, index) => (
                Bits.Option({ text: soldier.name, value: index.toString() })
              ))
            ])
            .actionId('id')),
      Blocks.Input({ label: '편지 제목', blockId: 'title' })
      .element(
        Elements.TextInput({ placeholder: '제목을 입력해주세요' })
          .actionId('title')),
      Blocks.Input({ label: '편지 내용', blockId: 'content' })
        .element(
          Elements.TextInput({ placeholder: '내용을 입력해주세요, 1000자 이상일경우 알아서 분할되어 전송됩니다.' })
            .multiline()
            .actionId('content'))
    ).buildToObject(),
    trigger_id: params.triggerId,
  }

  await callAPIMethod('views.open', messageData)
    
  return {
    statusCode: 200
  };
}

module.exports.interactions = async (event) => {
  const data = parseData<{
    payload: string
  }>(event.body);
  const payload = camelizeKeys(JSON.parse(data.payload));

  const submitData: {
    content: {
      content: {
        type: string,
        value: string,
      }
    },
    id: {
      id: {
        selectedOption : {
          text: { 
            type: string,
            text: string,
          },
          value: string,
        }
        type: string,
      }
    },
    title: {
      title: {
        type: string,
        value: string,
      }
    }
  } = payload.view.state.values;

  
  if (submitData.id.id.selectedOption.value === 'all') {
    let title = `${submitData.title.title.value} by `;
    try {
      title += await getNickName(payload.user.id);
    } catch {
      title += payload.user.name;
    }

    const splitContent = chunkString(submitData.content.content.value, 1000);

    const messageDatas: {
      soldier: Soldier,
      title: string,
      content: string,
    }[] = [];

    SOLDIER.map((soldier) => {
      splitContent.map((content, index) => {
        let resultTitle = title;
        if (splitContent.length > 1) {
          resultTitle += ` | ${index + 1}번째`;
        }
        messageDatas.push({
          soldier: getSoldierData(soldier),
          title: resultTitle,
          content,
        });
      })
    })

    let message = {
      blocks: '',
      channel: payload.user.id
    };


    try {
      const data = await Promise.all(messageDatas.map(async (data) => {
        try {
          const name = await sendMessage(
            data.soldier,
            data.title,
            data.content
          );
            
          return {
            name,
            success: true,
          }
        } catch {
          return {
            name: data.soldier.getName(),
            success: false,
          }
        }
      }));

      message['blocks'] = JSON.stringify([
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "*육군훈련소 편지봇입니다. :email:*"
          }
        },
        {
          "type": "divider"
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": data.find((v) => !v.success) ? '일부 편지를 보내지 못했습니다' : '모두에게 편지를 성공적으로 보냈습니다.\n',
            "emoji": true
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": '*편지발송 결과*',
          }
        },
        {
          "type": "divider"
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": `${data.length}개 성공`,
            "emoji": true
          }
        },
      ]);
    } catch (e) {
      message['blocks'] = JSON.stringify([
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "*육군훈련소 편지봇입니다. :email:*"
              }
            },
            {
              "type": "section",
              "text": {
                "type": "plain_text",
                "text": `오류가 발생했습니다 개발자에게 문의해주세요`,
                "emoji": true
              }
            },
            {
              "type": "divider"
            },
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "*내가 보낸 편지*"
              }
            },
            {
              "type": "section",
              "text": {
                "type": "plain_text",
                "text": `${submitData.title.title.value}`,
                "emoji": true
              }
            },
            {
              "type": "section",
              "text": {
                "type": "plain_text",
                "text": `${submitData.content.content.value}`,
                "emoji": true
              }
            },
            {
              "type": "divider"
            },
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": typeof e === 'object' ? '```' + JSON.stringify(e) + '```' : '```' + e + '```',
                "emoji": true
              }
            },
          ])
    }
    const data = await callAPIMethod('chat.postMessage', message);
  } else {
    let title = `${submitData.title.title.value} by `;
    try {
      title += await getNickName(payload.user.id);
    } catch {
      title += payload.user.name;
    }

    const splitContent = chunkString(submitData.content.content.value, 1000);

    const messageDatas: {
      soldier: Soldier,
      title: string,
      content: string,
    }[] = [];

    splitContent.map((content, index) => {
      let resultTitle = title;
      if (splitContent.length > 1) {
        resultTitle += ` | ${index + 1}번쨰`;
      }
      messageDatas.push({
        soldier: getSoldierData(SOLDIER[parseInt(submitData.id.id.selectedOption.value)]),
        title: resultTitle,
        content,
      });
    });

    try {
      const data = await Promise.all(messageDatas.map(async (data) => {
        try {
          const name = await sendMessage(
            data.soldier,
            data.title,
            data.content
          );
            
          return {
            name,
            success: true,
          }
        } catch {
          return {
            name: data.soldier.getName(),
            success: false,
          }
        }
      }));
  
      const message = {
        blocks: '',
        channel: payload.user.id
      };

      if (data.find((v) => !v.success)) {
        message['blocks'] = JSON.stringify([
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*육군훈련소 편지봇입니다. :email:*"
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "plain_text",
              "text": `오류가 발생했습니다 ㅠㅠㅠ`,
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "plain_text",
              "text": `${submitData.title.title.value}`,
              "emoji": true
            }
          },
          {
            "type": "section",
            "text": {
              "type": "plain_text",
              "text": `${submitData.content.content.value}`,
              "emoji": true
            }
          }
        ])
      } else {
        message['blocks'] = JSON.stringify([
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*육군훈련소 편지봇입니다. :email:*"
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "plain_text",
              "text": `${data[0].name}님께 편지를 보냈어요! :blob_yespls:`,
              "emoji": true
            }
          }
        ])
      }
    
      await callAPIMethod('chat.postMessage', message);
    } catch (e) {
      const message = {
        blocks: JSON.stringify([
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "*육군훈련소 편지봇입니다. :email:*"
              }
            },
            {
              "type": "section",
              "text": {
                "type": "plain_text",
                "text": `오류가 발생했습니다 개발자에게 문의해주세요`,
                "emoji": true
              }
            },
            {
              "type": "divider"
            },
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "*내가 보낸 편지*"
              }
            },
            {
              "type": "section",
              "text": {
                "type": "plain_text",
                "text": `${submitData.title.title.value}`,
                "emoji": true
              }
            },
            {
              "type": "section",
              "text": {
                "type": "plain_text",
                "text": `${submitData.content.content.value}`,
                "emoji": true
              }
            },
            {
              "type": "divider"
            },
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": typeof e === 'object' ? '```' + JSON.stringify(e) + '```' : '```' + e + '```',
                "emoji": true
              }
            },
          ]),
        channel: payload.user.id
      }
      console.error(e)
      await callAPIMethod('chat.postMessage', message);
    }
  }
  return {
    statusCode: 200
  };
}