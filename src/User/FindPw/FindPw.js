import React, { useState } from "react";
import "../Login/Login.css";
import { useNavigate } from "react-router-dom";
import { resetPasswordForEmail } from "../../services/supabaseApi";

export default function FindPw() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await resetPasswordForEmail(email);
      setMessage("비밀번호 재설정 링크가 이메일로 전송되었습니다. 받은편지함을 확인해주세요.");
    } catch (err) {
      setError(err.message || "비밀번호 재설정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">비밀번호 찾기</h2>
        <p className="login-subtitle">가입 시 사용한 이메일을 입력해주세요.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {message && <p style={{ color: "green", fontSize: "14px" }}>{message}</p>}
          {error && <p style={{ color: "red", fontSize: "14px" }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '전송 중...' : '비밀번호 재설정 링크 전송'}
          </button>
        </form>

        <div className="login-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/login")}
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}