import React, { useState } from "react";
import "../Login/Login.css"; // 같은 스타일 재사용
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPw) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError("");
    // TODO: 회원가입 로직 연결
    console.log("회원가입 성공");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">회원가입</h1>
        <p className="login-subtitle">하루온에 오신 걸 환영합니다 🎉</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* 닉네임 */}
          <div className="form-field">
            <label htmlFor="nickname">닉네임</label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              placeholder="닉네임을 입력하세요"
              required
            />
          </div>

          {/* 아이디 */}
          <div className="form-field">
            <label htmlFor="userid">아이디</label>
            <input
              id="userid"
              name="userid"
              type="text"
              placeholder="아이디를 입력하세요"
              required
              autoComplete="username"
            />
          </div>

          {/* 비밀번호 */}
          <div className="form-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="비밀번호 입력"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* 비밀번호 확인 */}
          <div className="form-field">
            <label htmlFor="confirmPw">비밀번호 확인</label>
            <input
              id="confirmPw"
              name="confirmPw"
              type="password"
              placeholder="비밀번호 확인"
              required
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>

          {/* 이메일 */}
          <div className="form-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="이메일 입력"
              required
              autoComplete="email"
            />
          </div>

          {/* 에러 메시지 */}
          {error && <p style={{ color: "red", fontSize: "14px" }}>{error}</p>}

          <button type="submit" className="btn btn-primary" onClick={() => {navigate("/Login")}}>
            회원가입 완료
          </button>
        </form>
      </div>
    </div>
  );
}
