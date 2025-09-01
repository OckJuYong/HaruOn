import React, { useState } from "react";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { signIn } from "../../services/supabaseApi";

const getFriendlyErrorMessage = (message) => {
  if (message.includes('Invalid login credentials')) {
    return '이메일 또는 비밀번호가 일치하지 않습니다.';
  }
  if (message.includes('Email not confirmed')) {
    return '이메일이 인증되지 않았습니다. 받은편지함을 확인해주세요.';
  }
  return '로그인 중 오류가 발생했습니다.';
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn({ email, password });
      navigate("/home");
    } catch (err) {
      setError(getFriendlyErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">로그인</h2>
        <p className="login-subtitle">하루온에 오신 것을 환영합니다!</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p style={{ color: "red", fontSize: "14px" }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="login-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/findpw")}
          >
            비밀번호 찾기
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/signup")}
          >
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}