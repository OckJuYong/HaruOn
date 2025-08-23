import React from "react";
import "./Login.css";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">하루온 로그인</h1>
        <p className="login-subtitle">하루를 더 편하게, 지금 시작해요 ✨</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="userid">아이디</label>
            <input
              id="userid"
              name="userid"
              type="text"
              placeholder="ID"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="PW"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary">
            로그인
          </button>
        </form>

        <div className="login-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/Findpw")}
          >
            비밀번호 찾기
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/Signup")}
          >
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}
