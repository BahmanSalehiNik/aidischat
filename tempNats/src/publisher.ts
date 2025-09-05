import nats from 'node-nats-streaming';

console.clear();

const client = nats.connect('ecommerce-models', 'abc', {
    url: 'http://localhost:4222'
});


client.on('connect', ()=>{
        client.on('close', ()=>{
        console.log('Listener NATS connection closed!')
        process.exit()
    });
    console.log('Publisher connected to NATS')

    const ecommerceData = JSON.stringify({
            "id": "68ac537b92ac6a8562fa90c2",
            "ecommerceModelId":"somenewmodel2",
            "price": 35
        })
    
    client.publish('ecommerce-model:created',ecommerceData,()=>{
        console.log('ecommerce model creation event published.')
    })
})

process.on('SIGINT', ()=>client.close());
process.on('SIGTERM', ()=> client.close());