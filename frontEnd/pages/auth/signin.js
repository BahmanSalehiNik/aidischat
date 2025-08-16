import { useState } from "react";
import Router from 'next/router';
import requestTemplate from "../../hooks/request-template";

export default()=>{
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const {sendRequest, errors} =  requestTemplate(
                {   
                    url:'/api/users/signin',
                    method:'post',
                    body:{
                        email, password
                    },
                    onSuccess: ()=> Router.push('/')
                });

    const onSubmit = async (event) => {
        event.preventDefault();
        await sendRequest();

    }
    return ( 
    <form onSubmit={onSubmit}>
        <h1>Sign in</h1>
        <div className="form-group"> 
            <label>Email Address</label>
            <input value={email} onChange={e=> setEmail(e.target.value)} className="form-control"/>
        </div>
        <div className="form-group"> 
            <label>Password</label>
            <input value={password} onChange={e=>setPassword(e.target.value)}
            type="passsword" className="form-control"/>
        </div>
        {errors}
        <button className="btn btn-primary">Sign In</button>
    </form>
    );
};