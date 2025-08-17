import { useEffect } from "react";
import Router from 'next/router';
import requestTemplate from "../../hooks/request-template";

export default()=>{
    const {sendRequest, errors} =  requestTemplate(
                {   
                    url:'/api/users/signout',
                    method:'post',
                    body:{},
                    onSuccess: ()=> Router.push('/')
                });
    
    useEffect( ()=>{
        sendRequest()
    }, [])           
    return <div>Loggin out!</div>       
}